import { NextResponse } from "next/server";

const MAX_RETRIES = 3;
const RETRY_DELAY = 1500;

async function fetchWithRetry(url: string, options: RequestInit, retries: number = MAX_RETRIES): Promise<Response> {
    try {
        const response = await fetch(url, options);
        if (!response.ok && retries > 0) {
            console.warn(`API request failed with status ${response.status}. Retrying... (${retries - 1} left)`);
            await new Promise(res => setTimeout(res, RETRY_DELAY));
            return fetchWithRetry(url, options, retries - 1);
        }
        return response;
    } catch (error) {
        if (retries > 0) {
            console.warn(`API request threw an error. Retrying... (${retries - 1} left)`, error);
            await new Promise(res => setTimeout(res, RETRY_DELAY));
            return fetchWithRetry(url, options, retries - 1);
        }
        throw error;
    }
}

export async function POST(req: Request) {
  try {
    const { prompt, negativePrompt, style, aspectRatio, seed, cfgScale, steps } = await req.json();

    if (!prompt) return new NextResponse("Prompt is required", { status: 400 });
    if (!style) return new NextResponse("Style is required", { status: 400 });
    if (!aspectRatio) return new NextResponse("Aspect ratio is required", { status: 400 });

    const styleMap: { [key: string]: string } = {
        Hyperrealistic: ", 8k, photorealistic, cinematic lighting, ultra-detailed, professional photography",
        Anime: ", anime style, key visual, vibrant colors, digital art, by makoto shinkai",
        "Digital Painting": ", digital painting, concept art, smooth, sharp focus, illustration, by artgerm",
        Cinematic: ", cinematic still, movie poster, dramatic lighting, epic, emotional",
        "Retro Futurism": ", retro futurism, 1980s style, synthwave, vintage sci-fi poster, grainy",
        "Low Poly": ", low poly, 3d render, isometric, vibrant colors, simple shapes",
        "Comic Book": ", comic book art, graphic novel style, bold lines, cel shading, by jim lee",
        "Dark Fantasy": ", dark fantasy art, intricate detail, epic scale, magical, ominous, by greg rutkowski",
        Cyberpunk: ", cyberpunk, neon lights, futuristic city, blade runner aesthetic, dystopian"
    };

    const aspectRatioMap: { [key: string]: string } = {
        "1:1": "&width=1024&height=1024",
        "16:9": "&width=1536&height=864",
        "9:16": "&width=864&height=1536",
        "4:3": "&width=1024&height=768",
        "3:4": "&width=768&height=1024"
    };
    
    let fullPrompt = `${prompt}${styleMap[style] || ""}`;
    if (negativePrompt) {
        fullPrompt += `, (worst quality, low quality, normal quality, blurry, deformed, ugly), ${negativePrompt}`;
    }

    const params = new URLSearchParams();
    params.append("width", (aspectRatioMap[aspectRatio] || "&width=1024&height=1024").split('&')[1].split('=')[1]);
    params.append("height", (aspectRatioMap[aspectRatio] || "&width=1024&height=1024").split('&')[2].split('=')[1]);
    params.append("seed", String(seed || Math.floor(Math.random() * 10000000)));
    params.append("cfg", String(cfgScale || 7.5));
    params.append("steps", String(steps || 25));
    params.append("nologo", "true");

    const encodedPrompt = encodeURIComponent(fullPrompt);
    const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?${params.toString()}`;

    console.log(`Fetching from: ${imageUrl}`);
    
    const response = await fetchWithRetry(imageUrl, { headers: { 'Accept': 'image/png' } });

    if (!response.ok || !response.body) {
      const errorBody = await response.text();
      console.error(`Pollinations API Error (${response.status}): ${errorBody}`);
      throw new Error(`The image generation service failed after multiple attempts. It may be temporarily down. Please try again later.`);
    }

    const imageBlob = await response.blob();
    
    if(!imageBlob.type.startsWith('image/')) {
        console.error("Pollinations API did not return an image. It may be down or the prompt was rejected.", imageBlob);
        throw new Error("The image generation service returned an invalid response. Please try a different prompt or check the service status.");
    }

    const headers = new Headers();
    headers.set("Content-Type", imageBlob.type);

    return new NextResponse(imageBlob, { status: 200, statusText: "OK", headers });

  } catch (error: any) {
    console.error("[GENERATION_ERROR]", error);
    const errorMessage = error.message || "An unknown internal server error occurred.";
    return new NextResponse(errorMessage, { status: 500, statusText: errorMessage });
  }
}