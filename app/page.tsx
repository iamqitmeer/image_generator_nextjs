"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { v4 as uuidv4 } from "uuid";
import { motion, AnimatePresence } from "framer-motion";
import {
    Wand2, Bot, Image as ImageIcon, GalleryVerticalEnd, Trash2, Download, Maximize, X,
    ChevronDown, Check, Settings, Palette, Ratio, Hash, SlidersHorizontal, ChevronsLeft,
    ChevronsRight, Clapperboard, Paintbrush, Copy, CopyCheck, RotateCcw, Lock, Unlock, Dices,
    LoaderCircle, AlertCircle, UploadCloud, Eraser, Sparkles
} from "lucide-react";

type AspectRatio = "1:1" | "16:9" | "9:16" | "4:3" | "3:4";
type Model = "stable-diffusion-xl" | "anime" | "photorealistic";

interface GenerationParams {
    prompt: string;
    negativePrompt: string;
    model: Model;
    aspectRatio: AspectRatio;
    seed: number;
    cfgScale: number;
    steps: number;
    createdAt: string;
    uploadedImageUrl?: string;
    imageStrength?: number;
}

interface GeneratedImage extends GenerationParams {
    id: string;
    url: string;
}

const modelDetails: { [key in Model]: { id: string; name: string; defaultSteps: number } } = {
    "stable-diffusion-xl": { id: "stability-ai/sdxl:39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b", name: "Stable Diffusion XL", defaultSteps: 25 },
    "photorealistic": { id: "lucataco/photorealistic-fuen-v1:517f51b64653b68334467389441113b2e0430154cf5e296e8648ba745c2698e6", name: "Photorealistic Fusion", defaultSteps: 30 },
    "anime": { id: "lucataco/anime-fuen-v1:30a73c9b4c73f78e02554792a6c3f25b304c005b630e527f316223b209d7010f", name: "Anime Fusion", defaultSteps: 25 },
};

const NegativePromptPreset = React.memo(({ children, onClick }: { children: React.ReactNode; onClick: () => void }) => (
    <button type="button" onClick={onClick} className="px-2 py-1 text-xs bg-neutral-800 text-neutral-400 rounded-md hover:bg-neutral-700 hover:text-white transition-colors">
        {children}
    </button>
));

const CustomSelect = React.memo(({ options, value, onChange, icon: Icon }: { options: { value: string, label: string }[], value: string, onChange: (value: any) => void, icon?: React.ElementType }) => {
    const [isOpen, setIsOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => { if (ref.current && !ref.current.contains(event.target as Node)) setIsOpen(false); };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);
    return (
        <div className="relative w-full" ref={ref}>
            <button type="button" onClick={() => setIsOpen(!isOpen)} className="flex items-center justify-between w-full bg-black border border-neutral-800 rounded-lg shadow-sm px-3 py-2.5 text-left cursor-pointer focus:outline-none focus:ring-2 focus:ring-white sm:text-sm">
                <div className="flex items-center">{Icon && <Icon className="h-4 w-4 mr-2 text-neutral-400" />}<span className="block truncate">{options.find(o => o.value === value)?.label}</span></div>
                <ChevronDown className={`h-5 w-5 text-neutral-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            <AnimatePresence>
                {isOpen && <motion.ul initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="absolute z-10 mt-1 w-full bg-black border border-neutral-800 shadow-lg max-h-60 rounded-md py-1 text-base ring-1 ring-black ring-opacity-5 overflow-auto focus:outline-none sm:text-sm">
                    {options.map((option) => (<li key={option.value} onClick={() => { onChange(option.value); setIsOpen(false); }} className="text-neutral-200 cursor-default select-none relative py-2 pl-3 pr-9 hover:bg-neutral-800 flex items-center justify-between">{option.label} {value === option.value && <Check className="h-4 w-4 text-white" />}</li>))}
                </motion.ul>}
            </AnimatePresence>
        </div>
    );
});

const MemoizedIcon = React.memo(Sparkles);

export default function Home() {
    const [prompt, setPrompt] = useState<string>("");
    const [negativePrompt, setNegativePrompt] = useState<string>("(worst quality, low quality, normal quality), blurry, ugly, text, watermark, signature");
    const [model, setModel] = useState<Model>("stable-diffusion-xl");
    const [aspectRatio, setAspectRatio] = useState<AspectRatio>("1:1");
    const [seed, setSeed] = useState<number>(() => Math.floor(Math.random() * 10000000));
    const [isSeedLocked, setIsSeedLocked] = useState<boolean>(false);
    const [cfgScale, setCfgScale] = useState<number>(7);
    const [steps, setSteps] = useState<number>(modelDetails[model].defaultSteps);
    const [uploadedImage, setUploadedImage] = useState<string | null>(null);
    const [imageStrength, setImageStrength] = useState<number>(0.8);

    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [toast, setToast] = useState<{ id: string, message: string; type: 'success' | 'error' | 'info' } | null>(null);
    const [gallery, setGallery] = useState<GeneratedImage[]>([]);
    const [activeImageId, setActiveImageId] = useState<string | null>(null);
    const [isFullScreen, setIsFullScreen] = useState(false);
    const [copiedStates, setCopiedStates] = useState<{ [key: string]: boolean }>({});
    const [isLeftPanelOpen, setIsLeftPanelOpen] = useState(true);
    const [isRightPanelOpen, setIsRightPanelOpen] = useState(true);

    const promptInputRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        try { const s = localStorage.getItem("ai-forge-gallery"); if (s) { const p = JSON.parse(s); setGallery(p); if (p.length > 0) setActiveImageId(p[0].id); } } catch (e) { console.error(e); }
        const settings = localStorage.getItem("ai-forge-settings");
        if (settings) {
            try {
                const { prompt, negativePrompt, model, aspectRatio, seed, cfgScale, steps } = JSON.parse(settings);
                if (prompt) setPrompt(prompt);
                if (negativePrompt) setNegativePrompt(negativePrompt);
                if (model) setModel(model);
                if (aspectRatio) setAspectRatio(aspectRatio);
                if (seed) setSeed(seed);
                if (cfgScale) setCfgScale(cfgScale);
                if (steps) setSteps(steps);
            } catch (e) { console.error("Failed to parse settings", e); }
        }
    }, []);

    useEffect(() => {
        try {
            const settings = { prompt, negativePrompt, model, aspectRatio, seed, cfgScale, steps };
            localStorage.setItem("ai-forge-settings", JSON.stringify(settings));
        } catch (e) { console.error("Failed to save settings", e); }
    }, [prompt, negativePrompt, model, aspectRatio, seed, cfgScale, steps]);

    useEffect(() => {
        try { localStorage.setItem("ai-forge-gallery", JSON.stringify(gallery)); } catch (e) { console.error(e); }
    }, [gallery]);
    
    useEffect(() => { let t: NodeJS.Timeout; if (toast) { t = setTimeout(() => setToast(null), 3000); } return () => clearTimeout(t); }, [toast]);
    useEffect(() => { setSteps(modelDetails[model].defaultSteps) }, [model]);

    const activeImage = useMemo(() => gallery.find(img => img.id === activeImageId), [gallery, activeImageId]);

    const showToast = useCallback((message: string, type: 'success' | 'error' | 'info') => { setToast({ id: uuidv4(), message, type }); }, []);
    
    const handleCopy = useCallback((text: string, id: string) => {
        navigator.clipboard.writeText(text);
        setCopiedStates(prev => ({ ...prev, [id]: true }));
        setTimeout(() => setCopiedStates(prev => ({ ...prev, [id]: false })), 2000);
    }, []);

    const handleSurpriseMe = useCallback(() => {
        const surprise = surprisePrompts[Math.floor(Math.random() * surprisePrompts.length)];
        setPrompt(surprise.prompt);
        if (!isSeedLocked) setSeed(Math.floor(Math.random() * 10000000));
        showToast("Prompt injected!", 'info');
        promptInputRef.current?.focus();
    }, [isSeedLocked, showToast]);

    const generateImage = useCallback(async (e: React.FormEvent) => {
        e.preventDefault();
        if (!prompt.trim()) { setError("Prompt cannot be empty."); return; }
        setLoading(true); setError(null);
        const currentSeed = isSeedLocked ? seed : Math.floor(Math.random() * 10000000);
        if (!isSeedLocked) setSeed(currentSeed);
        const params: Omit<GenerationParams, 'createdAt'> = { prompt, negativePrompt, model, aspectRatio, seed: currentSeed, cfgScale, steps, uploadedImageUrl: uploadedImage, imageStrength };
        try {
            const res = await fetch("/api/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(params) });
            if (!res.ok) { const errorText = await res.text(); throw new Error(errorText || "Generation failed"); }
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const newImage: GeneratedImage = { id: uuidv4(), url, ...params, createdAt: new Date().toISOString() };
            setGallery(prev => [newImage, ...prev]); setActiveImageId(newImage.id);
            showToast("Generation complete!", 'success');
        } catch (err: any) { setError(err.message); showToast(err.message, 'error'); } finally { setLoading(false); }
    }, [prompt, negativePrompt, model, aspectRatio, seed, isSeedLocked, cfgScale, steps, showToast, uploadedImage, imageStrength]);

    const rehydrateFromHistory = useCallback((image: GeneratedImage) => {
        setPrompt(image.prompt); setNegativePrompt(image.negativePrompt); setModel(image.model); setAspectRatio(image.aspectRatio); setSeed(image.seed); setCfgScale(image.cfgScale); setSteps(image.steps); setActiveImageId(image.id); setUploadedImage(image.uploadedImageUrl || null); setImageStrength(image.imageStrength || 0.8);
        showToast("Settings loaded from history", 'info');
    }, [showToast]);

    const deleteImage = useCallback((id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setGallery(current => {
            const updated = current.filter(img => img.id !== id);
            if (activeImageId === id) setActiveImageId(updated.length > 0 ? updated[0].id : null);
            return updated;
        });
        showToast("Image deleted", 'success');
    }, [activeImageId, showToast]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (loadEvent) => { setUploadedImage(loadEvent.target?.result as string); };
            reader.readAsDataURL(file);
        }
    };

    const dropHandler = (ev: React.DragEvent<HTMLDivElement>) => {
        ev.preventDefault();
        if (ev.dataTransfer.items && ev.dataTransfer.items[0].kind === 'file') {
            const file = ev.dataTransfer.items[0].getAsFile();
            if (file) {
                 const reader = new FileReader();
                 reader.onload = (loadEvent) => { setUploadedImage(loadEvent.target?.result as string); };
                 reader.readAsDataURL(file);
            }
        }
    }
    const dragOverHandler = (ev: React.DragEvent<HTMLDivElement>) => ev.preventDefault();

    return (
        <div className="min-h-screen bg-black text-white flex font-sans selection:bg-white/30 overflow-hidden">
            <AnimatePresence>{toast && <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className={`fixed bottom-5 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-2 rounded-lg shadow-2xl text-black ${toast.type === 'success' ? 'bg-white' : toast.type === 'error' ? 'bg-red-500 text-white' : 'bg-neutral-400'}`}><AlertCircle className="h-5 w-5" />{toast.message}</motion.div>}</AnimatePresence>
            <AnimatePresence>{isFullScreen && activeImage && <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center backdrop-blur-sm" onClick={() => setIsFullScreen(false)}><motion.img initial={{scale:0.8}} animate={{scale:1}} exit={{scale:0.8}} src={activeImage.url} alt={activeImage.prompt} className="max-h-full max-w-full object-contain" /><button className="absolute top-4 right-4 text-white hover:text-neutral-400 transition-colors" onClick={() => setIsFullScreen(false)}><X className="h-8 w-8" /></button></motion.div>}</AnimatePresence>

            <motion.aside animate={{ width: isLeftPanelOpen ? 320 : 0, x: isLeftPanelOpen ? 0 : -320 }} transition={{ ease: "easeInOut", duration: 0.3 }} className="bg-black border-r border-neutral-800 flex flex-col flex-shrink-0">
                <div className="flex items-center justify-between p-4 border-b border-neutral-800 flex-shrink-0"><h1 className="text-xl font-bold flex items-center"><GalleryVerticalEnd className="mr-2"/> History</h1></div>
                <div className="flex-grow overflow-y-auto p-2 space-y-2">
                    <AnimatePresence>{gallery.length > 0 ? gallery.map((img) => (
                        <motion.div key={img.id} layout initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9 }} onClick={() => setActiveImageId(img.id)} className={`relative group cursor-pointer rounded-lg overflow-hidden border-2 transition-colors duration-200 ${activeImageId === img.id ? "border-white" : "border-neutral-800 hover:border-neutral-700"}`}>
                            <img src={img.url} alt={img.prompt} className="w-full h-24 object-cover" loading="lazy" />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent p-2 flex flex-col justify-end"><p className="text-xs text-white line-clamp-2 opacity-0 group-hover:opacity-100 transition-opacity">{img.prompt}</p></div>
                            <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                                <button onClick={(e) => {e.stopPropagation(); rehydrateFromHistory(img);}} className="p-1.5 bg-black/50 rounded-full hover:bg-white hover:text-black"><RotateCcw className="h-4 w-4"/></button>
                                <button onClick={(e) => deleteImage(img.id, e)} className="p-1.5 bg-black/50 rounded-full hover:bg-white hover:text-black"><Trash2 className="h-4 w-4"/></button>
                            </div>
                        </motion.div>
                    )) : <motion.div initial={{opacity:0}} animate={{opacity:1}} className="flex flex-col items-center justify-center h-full text-neutral-600 text-center"><ImageIcon className="h-16 w-16 mb-4"/> <h3 className="font-semibold text-neutral-400">No images yet</h3> <p className="text-sm">Your creations will appear here.</p></motion.div>}
                    </AnimatePresence>
                </div>
            </motion.aside>

            <main className="flex-1 p-4 md:p-6 flex flex-col items-center justify-center relative">
                <button onClick={() => setIsLeftPanelOpen(!isLeftPanelOpen)} className="absolute top-1/2 -translate-y-1/2 left-0 z-10 p-1 bg-neutral-900/80 rounded-r-md hover:bg-white hover:text-black"><ChevronsRight className={`transition-transform duration-300 ${isLeftPanelOpen ? '' : 'rotate-180'}`} /></button>
                <button onClick={() => setIsRightPanelOpen(!isRightPanelOpen)} className="absolute top-1/2 -translate-y-1/2 right-0 z-10 p-1 bg-neutral-900/80 rounded-l-md hover:bg-white hover:text-black"><ChevronsLeft className={`transition-transform duration-300 ${isRightPanelOpen ? '' : 'rotate-180'}`} /></button>
                <div className="w-full h-full flex items-center justify-center bg-black rounded-lg border-2 border-dashed border-neutral-800 relative overflow-hidden" onDrop={dropHandler} onDragOver={dragOverHandler}>
                    <AnimatePresence mode="wait">{loading ? <motion.div key="loader" initial={{opacity:0, scale:0.8}} animate={{opacity:1, scale:1}} exit={{opacity:0, scale:0.8}} className="text-center p-8 flex flex-col items-center"><LoaderCircle className="w-16 h-16 text-white animate-spin mb-4"/><p className="text-lg font-semibold">Creating Magic...</p></motion.div>
                    : activeImage ? <motion.div key="activeImage" initial={{opacity:0, scale:0.95}} animate={{opacity:1, scale:1}} className="relative group w-full h-full flex items-center justify-center"><img src={activeImage.url} alt={activeImage.prompt} className="max-h-full max-w-full object-contain" /><div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                        <button onClick={() => setIsFullScreen(true)} className="p-2 bg-black/60 rounded-full hover:bg-white hover:text-black"><Maximize className="h-5 w-5"/></button>
                        <a href={activeImage.url} download={`art-${activeImage.id.slice(0,8)}.png`} className="p-2 bg-black/60 rounded-full hover:bg-white hover:text-black"><Download className="h-5 w-5"/></a>
                        <button onClick={() => handleCopy(String(activeImage.seed), `s-${activeImage.id}`)} className="p-2 bg-black/60 rounded-full hover:bg-white hover:text-black">{copiedStates[`s-${activeImage.id}`] ? <CopyCheck className="h-5 w-5 text-green-400"/> : <Copy className="h-5 w-5"/>}</button>
                    </div></motion.div>
                    : <motion.div key="placeholder" initial={{opacity:0}} animate={{opacity:1}} className="text-center text-neutral-600 p-8 flex flex-col items-center"><Bot className="h-20 w-20 mb-4"/><h3 className="text-xl font-semibold text-neutral-400">AI Forge</h3><p>Describe your vision or drop an image to begin.</p></motion.div>}
                    </AnimatePresence>
                </div>
                {activeImage && <div className="mt-4 p-3 bg-neutral-900/70 rounded-md w-full max-w-4xl text-center"><p className="font-semibold text-white">{activeImage.prompt}</p></div>}
            </main>

            <motion.aside animate={{ width: isRightPanelOpen ? 384 : 0, x: isRightPanelOpen ? 0 : 384 }} transition={{ ease: "easeInOut", duration: 0.3 }} className="bg-black border-l border-neutral-800 flex flex-col flex-shrink-0">
                <form onSubmit={generateImage} className="flex-grow flex flex-col">
                    <h1 className="text-xl font-bold p-4 border-b border-neutral-800 flex-shrink-0">Forge</h1>
                    <div className="flex-grow overflow-y-auto p-4 space-y-5">
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-white">Prompt</label>
                            <textarea ref={promptInputRef} value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="An epic fantasy landscape..." className="w-full bg-black border border-neutral-800 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-white h-32 resize-y" />
                            <button type="button" onClick={handleSurpriseMe} className="w-full flex items-center justify-center gap-2 p-2 bg-neutral-800 hover:bg-neutral-700 rounded-md text-sm font-semibold"><Wand2 className="h-4 w-4"/> Surprise Me</button>
                        </div>
                         <AnimatePresence>
                         {uploadedImage && (
                            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="space-y-2 overflow-hidden">
                                <label className="text-sm font-bold text-white">Source Image</label>
                                <div className="relative">
                                    <img src={uploadedImage} alt="Uploaded preview" className="rounded-lg w-full" />
                                    <button type="button" onClick={() => setUploadedImage(null)} className="absolute top-2 right-2 p-1.5 bg-black/50 rounded-full hover:bg-white hover:text-black transition-colors"><X className="h-4 w-4" /></button>
                                </div>
                                <div>
                                    <label className="flex justify-between text-xs font-medium text-neutral-300 mb-1"><span>Image Strength</span><span className="text-neutral-400">{imageStrength.toFixed(2)}</span></label>
                                    <input type="range" min={0.1} max={1.0} step={0.01} value={imageStrength} onChange={e => setImageStrength(parseFloat(e.target.value))} className="w-full h-2 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-white" />
                                </div>
                            </motion.div>
                         )}
                         </AnimatePresence>
                         {!uploadedImage && <div className="space-y-2"><label className="text-sm font-bold text-white">Image-to-Image (Optional)</label><label htmlFor="image-upload" className="cursor-pointer flex flex-col items-center justify-center w-full h-24 border-2 border-neutral-800 border-dashed rounded-lg hover:bg-neutral-900 transition-colors"><div className="flex flex-col items-center justify-center pt-5 pb-6 text-neutral-500"><UploadCloud className="w-8 h-8 mb-2"/><p className="text-sm">Click to upload or drag & drop</p></div><input id="image-upload" type="file" className="hidden" accept="image/png, image/jpeg" onChange={handleFileChange}/></label></div>}

                        <div className="space-y-2">
                             <label className="text-sm font-bold text-white">Negative Prompt</label>
                             <textarea value={negativePrompt} onChange={(e) => setNegativePrompt(e.target.value)} className="w-full bg-black border border-neutral-800 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-white h-20 resize-y" />
                             <div className="flex gap-2 flex-wrap">
                                 <NegativePromptPreset onClick={() => setNegativePrompt(p => p + ", text, watermark, signature")}>+ Text</NegativePromptPreset>
                                 <NegativePromptPreset onClick={() => setNegativePrompt(p => p + ", deformed, disfigured")}>+ Deformed</NegativePromptPreset>
                                 <NegativePromptPreset onClick={() => setNegativePrompt("")}> <Eraser className="w-3 h-3 inline-block mr-1"/> Clear</NegativePromptPreset>
                             </div>
                        </div>

                        <div className="space-y-4">
                            <CustomSelect value={model} onChange={setModel} options={Object.entries(modelDetails).map(([k, v]) => ({ value: k, label: v.name }))} icon={Bot} />
                            <CustomSelect value={aspectRatio} onChange={setAspectRatio} options={[{value: '1:1', label: '1:1 Square'}, {value: '16:9', label: '16:9 Landscape'}, {value: '9:16', label: '9:16 Portrait'}, {value: '4:3', label: '4:3 Standard'}, {value: '3:4', label: '3:4 Vertical'}]} icon={Ratio} />
                        </div>
                        <div className="space-y-4 pt-4 border-t border-neutral-800">
                             <div><label className="text-sm font-bold text-white">Advanced</label><div className="flex items-center gap-2 mt-2"><div className="relative flex-grow"><Hash className="h-4 w-4 absolute left-2 top-1/2 -translate-y-1/2 text-neutral-500"/><input type="number" value={seed} onChange={e => setSeed(Number(e.target.value))} className="w-full bg-black border border-neutral-800 rounded-lg p-2.5 pl-8 focus:outline-none focus:ring-2 focus:ring-white" /></div>
                                <button type="button" onClick={() => setIsSeedLocked(!isSeedLocked)} className={`p-2.5 rounded-lg ${isSeedLocked ? 'bg-white text-black' : 'bg-neutral-800 hover:bg-neutral-700'}`}>{isSeedLocked ? <Lock className="h-5 w-5"/> : <Unlock className="h-5 w-5"/>}</button>
                                <button type="button" onClick={() => setSeed(Math.floor(Math.random() * 10000000))} className="p-2.5 rounded-lg bg-neutral-800 hover:bg-neutral-700"><Dices className="h-5 w-5"/></button>
                            </div></div>
                            <div><label className="flex justify-between text-xs font-medium text-neutral-300 mb-1"><span>Guidance (CFG)</span><span className="text-neutral-400">{cfgScale}</span></label><input type="range" min={1} max={20} step={0.5} value={cfgScale} onChange={e => setCfgScale(parseFloat(e.target.value))} className="w-full h-2 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-white" /></div>
                            <div><label className="flex justify-between text-xs font-medium text-neutral-300 mb-1"><span>Steps</span><span className="text-neutral-400">{steps}</span></label><input type="range" min={10} max={50} step={1} value={steps} onChange={e => setSteps(parseInt(e.target.value))} className="w-full h-2 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-white" /></div>
                        </div>

                    </div>
                    <div className="p-4 border-t border-neutral-800 flex-shrink-0">
                        {error && <p className="text-sm text-red-400 bg-red-900/30 p-2 rounded-md flex items-center gap-2 mb-3"><AlertCircle className="h-4 w-4"/>{error}</p>}
                        <motion.button whileTap={{ scale: 0.95 }} type="submit" disabled={loading} className="w-full flex items-center justify-center gap-2 text-lg font-bold p-3 bg-white text-black rounded-xl disabled:bg-neutral-700 disabled:text-neutral-400 disabled:cursor-not-allowed">
                            {loading ? <><LoaderCircle className="h-6 w-6 animate-spin"/>Generating...</> : <><MemoizedIcon className="h-6 w-6"/>Generate</>}
                        </motion.button>
                    </div>
                </form>
            </motion.aside>
        </div>
    );
}