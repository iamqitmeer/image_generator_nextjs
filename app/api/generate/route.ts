import { NextResponse } from "next/server";
import Replicate from "replicate";

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

const modelDetails: { [key: string]: { id: string } } = {
    "stable-diffusion-xl": { id: "stability-ai/sdxl:39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b" },
    "photorealistic": { id: "lucataco/photorealistic-fuen-v1:517f51b64653b68334467389441113b2e0430154cf5e296e8648ba745c2698e6" },
    "anime": { id: "lucataco/anime-fuen-v1:30a73c9b4c73f78e02554792a6c3f25b304c005b630e527f316223b209d7010f" },
};

const aspectRatioMap: { [key: string]: { width: number, height: number } } = {
    "1:1": { width: 1024, height: 1024 },
    "16:9": { width: 1344, height: 768 },
    "9:16": { width: 768, height: 1344 },
    "4:3": { width: 1152, height: 896 },
    "3:4": { width: 896, height: 1152 },
};

export async function POST(req: Request) {
  try {
    if (!process.env.REPLICATE_API_TOKEN) {
      return new NextResponse(
        "Missing REPLICATE_API_TOKEN. Please check your .env.local file and restart the server.",
        { status: 500 }
      );
    }

    const body = await req.json();
    const { 
        prompt, 
        negativePrompt, 
        model, 
        aspectRatio, 
        seed, 
        cfgScale, 
        steps,
        uploadedImageUrl,
        imageStrength
    } = body;

    if (!prompt) {
      return new NextResponse("Prompt is required.", { status: 400 });
    }

    const selectedModel = modelDetails[model as keyof typeof modelDetails];
    if (!selectedModel) {
        return new NextResponse("Invalid model selected.", { status: 400 });
    }

    const dimensions = aspectRatioMap[aspectRatio as keyof typeof aspectRatioMap] || { width: 1024, height: 1024 };

    const apiInput: { [key: string]: any } = {
        prompt: prompt,
        negative_prompt: negativePrompt,
        seed: seed,
        guidance_scale: cfgScale,
        num_inference_steps: steps,
        width: dimensions.width,
        height: dimensions.height,
    };

    if (uploadedImageUrl && imageStrength) {
        apiInput.image = uploadedImageUrl;
        apiInput.image_guidance_scale = imageStrength;
    }

    console.log("Running Replicate with input:", apiInput);

    const output = await replicate.run(
      selectedModel.id as `${string}/${string}:${string}`,
      {
        input: apiInput,
      }
    );
    
    if (!output || !Array.isArray(output) || output.length === 0) {
        throw new Error("Failed to get a valid response from the generation API.");
    }

    const imageUrl = output[0];
    if (typeof imageUrl !== 'string') {
        throw new Error("API returned an invalid image URL format.");
    }

    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
        throw new Error(`Failed to fetch the generated image from URL. Status: ${imageResponse.status}`);
    }
    
    const imageBlob = await imageResponse.blob();
    const headers = new Headers();
    headers.set("Content-Type", imageResponse.headers.get("Content-Type") || "image/png");

    return new NextResponse(imageBlob, { status: 200, statusText: "OK", headers });

  } catch (error: any) {
    console.error("[GENERATION_ERROR]", error);

    let errorMessage = "An unknown error occurred during generation.";
    if (error.message) {
        if (error.message.includes('authentication')) {
            errorMessage = "Authentication failed. Please check your REPLICATE_API_TOKEN in the .env.local file and restart your server.";
        } else if (error.message.includes('billing')) {
            errorMessage = "Billing issue detected. You may have run out of Replicate credits. Please check your account dashboard.";
        } else if (error.message.includes('prediction failed')) {
            errorMessage = "The model failed to run. This might be a temporary Replicate issue. Please try again later.";
        } else {
            errorMessage = error.message;
        }
    }
    
    return new NextResponse(errorMessage, { status: 500, statusText: errorMessage });
  }
}