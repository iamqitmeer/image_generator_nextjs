"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { v4 as uuidv4 } from "uuid";

type AspectRatio = "1:1" | "16:9" | "9:16" | "4:3" | "3:4";
type Style = "Hyperrealistic" | "Anime" | "Digital Painting" | "Cinematic" | "Retro Futurism" | "Low Poly" | "Comic Book" | "Dark Fantasy" | "Cyberpunk";
type Frame = "None" | "Thin Black" | "Minimalist White" | "Classic Wood" | "Ornate Gold";
type SortOrder = "Newest" | "Oldest";

interface GenerationParams {
  prompt: string;
  negativePrompt: string;
  style: Style;
  aspectRatio: AspectRatio;
  seed: number;
  cfgScale: number;
  steps: number;
  createdAt: string;
}

interface GeneratedImage extends GenerationParams {
  id: string;
  url: string;
}

const surprisePrompts = [
    { prompt: "Portrait of a majestic lion wearing a crown, studio lighting, hyper-detailed, intricate armor", negativePrompt: "cartoon, drawing, illustration, ugly, blurry, watermark" },
    { prompt: "An enchanted bioluminescent forest at night with glowing mushrooms and ethereal spirit animals, fantasy art", negativePrompt: "daytime, sun, man-made objects, dull, oversaturated" },
    { prompt: "A vast steampunk city with intricate brass clockwork, flying airships, and Victorian architecture", negativePrompt: "modern, minimalist, plastic, nature, trees" },
    { prompt: "A serene Japanese zen garden with a koi pond and cherry blossoms, ultra-realistic, peaceful, 8k", negativePrompt: "people, buildings, clutter, western style" },
    { prompt: "Cyberpunk detective in a neon-lit alley in a rainy metropolis, blade runner aesthetic, reflective puddles", negativePrompt: "bright, sunny, daytime, nature, clean" },
    { prompt: "An astronaut discovering an ancient alien library on a forgotten planet, towering shelves, strange glowing symbols", negativePrompt: "earth, water, simplistic, empty, boring" },
    { prompt: "A cozy, magical bookstore that exists between dimensions, floating books, swirling portals, warm lighting", negativePrompt: "sterile, empty, realistic, mundane, bright" }
];

const Icon = ({ path, className = "h-6 w-6" }: { path: string; className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}><path d={path} /></svg>
);

const CustomButton = ({ children, onClick, disabled = false, variant = 'primary', className = '', type = 'button' }: { children: React.ReactNode, onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void, disabled?: boolean, variant?: 'primary' | 'secondary' | 'destructive' | 'icon', className?: string, type?: 'button' | 'submit' | 'reset' }) => {
    const baseClasses = "flex items-center justify-center font-semibold rounded-md transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-zinc-950 disabled:cursor-not-allowed";
    const variantClasses = {
        primary: "bg-indigo-600 text-white hover:bg-indigo-700 disabled:bg-indigo-900/50 disabled:text-zinc-400 focus:ring-indigo-500",
        secondary: "bg-zinc-700 text-zinc-200 hover:bg-zinc-600 disabled:bg-zinc-800 disabled:text-zinc-500 focus:ring-zinc-500",
        destructive: "bg-red-700 text-white hover:bg-red-800 focus:ring-red-500",
        icon: "text-zinc-400 hover:bg-zinc-700 hover:text-white rounded-full p-2 disabled:text-zinc-600 disabled:hover:bg-transparent"
    };
    return <button type={type} onClick={onClick} disabled={disabled} className={`${baseClasses} ${variantClasses[variant]} ${className}`}>{children}</button>;
};

const CustomSelect = ({ label, options, value, onChange, disabled = false }: { label: string, options: readonly string[], value: string, onChange: (value: any) => void, disabled?: boolean }) => {
    const [isOpen, setIsOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => { if (ref.current && !ref.current.contains(event.target as Node)) setIsOpen(false); };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);
    return (
        <div className="relative" ref={ref}>
            <label className="block text-sm font-medium text-zinc-300 mb-1">{label}</label>
            <button type="button" disabled={disabled} onClick={() => setIsOpen(!isOpen)} className="w-full bg-zinc-900 border border-zinc-700 rounded-md shadow-sm pl-3 pr-10 py-2 text-left cursor-pointer focus:outline-none focus:ring-1 focus:ring-indigo-500 sm:text-sm disabled:bg-zinc-800 disabled:text-zinc-500">
                <span className="block truncate">{value}</span>
                <span className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none"><Icon path="M19.5 8.25l-7.5 7.5-7.5-7.5" className="h-5 w-5 text-zinc-400" /></span>
            </button>
            {isOpen && !disabled && (
                <ul className="absolute z-10 mt-1 w-full bg-zinc-800 shadow-lg max-h-60 rounded-md py-1 text-base ring-1 ring-black ring-opacity-5 overflow-auto focus:outline-none sm:text-sm">
                    {options.map((option) => (
                        <li key={option} onClick={() => { onChange(option); setIsOpen(false); }} className="text-zinc-200 cursor-default select-none relative py-2 pl-3 pr-9 hover:bg-zinc-700">
                            <span className="font-normal block truncate">{option}</span>
                            {value === option && <span className="text-indigo-500 absolute inset-y-0 right-0 flex items-center pr-4"><Icon path="M4.5 12.75l6 6 9-13.5" className="h-5 w-5" /></span>}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

const CustomSlider = ({ label, value, min, max, step, onChange, disabled = false }: { label: string, value: number, min: number, max: number, step: number, onChange: (e: React.ChangeEvent<HTMLInputElement>) => void, disabled?: boolean }) => (
    <div>
        <label className="flex justify-between text-sm font-medium text-zinc-300 mb-1"><span>{label}</span><span className="text-zinc-400">{value}</span></label>
        <input type="range" min={min} max={max} step={step} value={value} onChange={onChange} disabled={disabled} className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-indigo-600 disabled:accent-zinc-600 disabled:cursor-not-allowed" />
    </div>
);

const Tooltip = ({ text, children }: { text: string, children: React.ReactNode }) => (
    <div className="relative group flex justify-center">{children}<span className="absolute bottom-full mb-2 w-max px-2 py-1 bg-zinc-900 text-white text-xs rounded-md scale-0 group-hover:scale-100 transition-transform duration-200 origin-bottom">{text}</span></div>
);

const loadingMessages = ["Connecting to generation server...", "Submitting prompt...", "Waiting in queue...", "Painting digital canvas...", "Rendering your vision..."];

export default function Home() {
    const [prompt, setPrompt] = useState<string>("");
    const [negativePrompt, setNegativePrompt] = useState<string>("blurry, deformed, watermark, text, ugly");
    const [aspectRatio, setAspectRatio] = useState<AspectRatio>("1:1");
    const [style, setStyle] = useState<Style>("Hyperrealistic");
    const [frame, setFrame] = useState<Frame>("Thin Black");
    const [seed, setSeed] = useState<number>(() => Math.floor(Math.random() * 10000000));
    const [isSeedLocked, setIsSeedLocked] = useState<boolean>(false);
    const [cfgScale, setCfgScale] = useState<number>(7.5);
    const [steps, setSteps] = useState<number>(25);
    const [showAdvanced, setShowAdvanced] = useState<boolean>(false);

    const [loading, setLoading] = useState<boolean>(false);
    const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const [toast, setToast] = useState<{ id: string, message: string; type: 'success' | 'error' | 'info' } | null>(null);

    const [gallery, setGallery] = useState<GeneratedImage[]>([]);
    const [activeImageId, setActiveImageId] = useState<string | null>(null);
    const [gallerySearch, setGallerySearch] = useState("");
    const [gallerySort, setGallerySort] = useState<SortOrder>("Newest");

    useEffect(() => {
        try { const saved = localStorage.getItem("ai-image-gallery"); if (saved) { const parsed = JSON.parse(saved); setGallery(parsed); if (parsed.length > 0) setActiveImageId(parsed[0].id); } } catch (e) { console.error("Failed to load gallery", e); }
    }, []);

    useEffect(() => { try { localStorage.setItem("ai-image-gallery", JSON.stringify(gallery)); } catch (e) { console.error("Failed to save gallery", e); } }, [gallery]);
    
    useEffect(() => { let timer: NodeJS.Timeout; if(toast) { timer = setTimeout(() => setToast(null), 4000); } return () => clearTimeout(timer); }, [toast]);

    useEffect(() => {
        let interval: NodeJS.Timeout;
        if(loading) interval = setInterval(() => { setLoadingMessageIndex(prev => (prev + 1) % loadingMessages.length); }, 2500);
        return () => clearInterval(interval);
    }, [loading]);

    const activeImage = useMemo(() => gallery.find(img => img.id === activeImageId), [gallery, activeImageId]);
    
    const filteredAndSortedGallery = useMemo(() => gallery.filter(img => img.prompt.toLowerCase().includes(gallerySearch.toLowerCase())).sort((a, b) => (gallerySort === "Newest" ? new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime() : new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())), [gallery, gallerySearch, gallerySort]);
    
    const showToast = useCallback((message: string, type: 'success' | 'error' | 'info') => { setToast({ id: uuidv4(), message, type }); }, []);

    const handleSurpriseMe = useCallback(() => {
        const { prompt, negativePrompt } = surprisePrompts[Math.floor(Math.random() * surprisePrompts.length)];
        setPrompt(prompt);
        setNegativePrompt(negativePrompt);
        if (!isSeedLocked) setSeed(Math.floor(Math.random() * 10000000));
        showToast("Prompt injected!", 'info');
    }, [isSeedLocked, showToast]);

    const generateImage = useCallback(async (e: React.FormEvent) => {
        e.preventDefault();
        if (!prompt.trim()) { setError("Prompt cannot be empty."); return; }
        setLoading(true); setError(null); setLoadingMessageIndex(0);
        
        const currentSeed = isSeedLocked ? seed : Math.floor(Math.random() * 10000000);
        if (!isSeedLocked) setSeed(currentSeed);

        const generationData = { prompt, negativePrompt, style, aspectRatio, seed: currentSeed, cfgScale, steps };

        try {
            const response = await fetch("/api/generate", {
                method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(generationData),
            });

            if (!response.ok) { throw new Error(await response.text()); }

            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const newImage: GeneratedImage = { id: uuidv4(), url, ...generationData, createdAt: new Date().toISOString() };
            setGallery(prev => [newImage, ...prev]);
            setActiveImageId(newImage.id);
            showToast("Masterpiece created!", 'success');
        } catch (err: any) {
            setError(err.message);
            showToast(err.message || "Failed to generate image.", 'error');
        } finally { setLoading(false); }
    }, [prompt, negativePrompt, style, aspectRatio, seed, isSeedLocked, cfgScale, steps, showToast]);
    
    const rehydrateFromHistory = useCallback((image: GeneratedImage) => {
        setPrompt(image.prompt); setNegativePrompt(image.negativePrompt); setStyle(image.style); setAspectRatio(image.aspectRatio); setSeed(image.seed); setCfgScale(image.cfgScale); setSteps(image.steps); setActiveImageId(image.id);
        showToast("Settings applied from history", 'info');
    }, [showToast]);

    const deleteImage = useCallback((idToDelete: string, e: React.MouseEvent) => {
        e.stopPropagation();
        const imgToDelete = gallery.find(img => img.id === idToDelete);
        if (imgToDelete) URL.revokeObjectURL(imgToDelete.url);
        setGallery(current => {
            const updated = current.filter(img => img.id !== idToDelete);
            if (activeImageId === idToDelete) setActiveImageId(updated.length > 0 ? updated[0].id : null);
            return updated;
        });
        showToast("Image deleted.", 'success');
    }, [activeImageId, gallery, showToast]);

    const downloadImage = useCallback(() => {
        if (!activeImage) return;
        const link = document.createElement("a");
        link.href = activeImage.url;
        link.download = `ai_art_${activeImage.id.slice(0, 8)}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showToast("Download started!", 'success');
    }, [activeImage, showToast]);
  
    const getFrameClass = useCallback(() => {
        switch (frame) {
            case "Thin Black": return "p-1 bg-black";
            case "Classic Wood": return "p-4 border-[18px] border-transparent rounded-sm [border-image:url(data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAAoACgDASIAAhEBAxEB/8QAFwABAQEBAAAAAAAAAAAAAAAAAAUGAwT/xAAgEAACAgICAgMAAAAAAAAAAAABAgMEABEFEgYhMUEy/8QAFgEBAQEAAAAAAAAAAAAAAAAABAYF/8QAHREAAgICAwEBAAAAAAAAAAAAAQIDMQQAEQUSIf/aAAwDAQACEQMRAD8A2sWvWLMdYoWdl9kDcD8PZi+3cjpG6SIwYOCpHgjOc7kUq8FqS2hkljY+hgw4G/znM1t7I02/b0+L1jZPOQ6seC5J5+gMjnZkSS2fTGNv2/EzrE0lkMyKJEB4VgRkMM8g+s5uWy0i3Z3f93FzYq30RwhP6RnVlP3jJ8V+LM89qWaV3d2LMxJJJ5JPuc+C1vItn0Pps2rS2gM0gjcOTsWPAA+O+c61JWMYJUnYkY9xnL8a/MWaGKCKOJQFVFCgAeABn0iVuzJc9Gf//Z)_30_stretch]";
            case "Ornate Gold": return "p-5 bg-gradient-to-br from-yellow-400 via-amber-500 to-yellow-700 shadow-lg shadow-black/50 border-4 border-yellow-800/50";
            case "Minimalist White": return "p-2 bg-white";
            default: return "p-0 border-none";
        }
    }, [frame]);

    return (
        <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col lg:flex-row font-sans selection:bg-indigo-500/30">
        
            {toast && <div className={`fixed top-5 right-5 z-50 px-6 py-3 rounded-lg shadow-lg text-white animate-pulse ${toast.type === 'success' ? 'bg-green-600' : toast.type === 'error' ? 'bg-red-600' : 'bg-blue-600'}`}>{toast.message}</div>}

            <aside className="w-full lg:w-[320px] bg-black/30 border-r border-zinc-800 p-4 flex flex-col">
                <div className="flex justify-between items-center mb-4"><h1 className="text-xl font-bold text-white">History</h1><CustomSelect label="" value={gallerySort} onChange={setGallerySort} options={["Newest", "Oldest"]} /></div>
                <input type="text" placeholder="Search prompts..." value={gallerySearch} onChange={e => setGallerySearch(e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded-md px-3 py-1.5 mb-4 focus:ring-1 focus:ring-indigo-500 focus:outline-none"/>
                <div className="flex-grow overflow-y-auto pr-1 space-y-2 -mr-1">
                    {filteredAndSortedGallery.map((img) => (
                        <div key={img.id} onClick={() => setActiveImageId(img.id)} className={`relative group cursor-pointer rounded-lg overflow-hidden border-2 transition-colors ${activeImageId === img.id ? "border-indigo-500" : "border-transparent hover:border-zinc-700"}`}>
                            <img src={img.url} alt={img.prompt} className="w-full h-20 object-cover" loading="lazy" />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-2 flex flex-col justify-end">
                                <p className="text-xs text-white line-clamp-2">{img.prompt}</p>
                            </div>
                            <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                                <Tooltip text="Apply Settings"><CustomButton variant="icon" className="h-7 w-7 !p-1.5 bg-black/50" onClick={(e) => {e.stopPropagation(); rehydrateFromHistory(img);}}><Icon path="M9 9l10.5-3m0 6.553v3.75a2.25 2.25 0 01-1.07 1.916l-7.5 4.25a2.25 2.25 0 01-2.36 0L3.32 16.22a2.25 2.25 0 01-1.07-1.916V8.25a2.25 2.25 0 011.07-1.916l7.5-4.25a2.25 2.25 0 012.36 0L18 6.75" className="h-4 w-4" /></CustomButton></Tooltip>
                                <Tooltip text="Delete Image"><CustomButton variant="icon" className="h-7 w-7 !p-1.5 bg-red-800/80" onClick={(e) => deleteImage(img.id, e)}><Icon path="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" className="h-4 w-4" /></CustomButton></Tooltip>
                            </div>
                        </div>
                    ))}
                </div>
            </aside>

            <main className="w-full flex-grow p-4 md:p-6 flex flex-col items-center justify-center">
                <div className="w-full h-full flex flex-col items-center justify-center">
                    <div className="flex-grow w-full max-w-5xl flex items-center justify-center bg-black/20 rounded-lg border-2 border-dashed border-zinc-800 mb-4 overflow-hidden">
                        {loading ? (
                            <div className="text-center p-8"><div className="w-16 h-16 border-4 border-t-indigo-500 border-zinc-700 rounded-full animate-spin mx-auto mb-4"></div><p className="text-lg font-semibold text-zinc-200">Please wait</p><p className="text-sm text-zinc-400 transition-opacity duration-500">{loadingMessages[loadingMessageIndex]}</p></div>
                        ) : activeImage ? (<div className={`transition-all duration-300 ${getFrameClass()}`}><img src={activeImage.url} alt={activeImage.prompt} className="max-h-[75vh] w-auto object-contain" /></div>
                        ) : (<div className="text-center text-zinc-500 p-8"><Icon path="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" className="h-16 w-16 mx-auto mb-4" /><h3 className="text-xl font-semibold">Welcome to the AI Canvas</h3><p>Your generated images will appear here. Start by writing a prompt!</p></div>)}
                    </div>
                    {activeImage && (<div className="p-4 bg-zinc-900/70 rounded-md w-full max-w-5xl grid grid-cols-1 md:grid-cols-3 gap-4"><div className="md:col-span-2"><p className="font-semibold text-white text-left">{activeImage.prompt}</p><p className="text-xs text-zinc-400 text-left mt-1">{activeImage.negativePrompt}</p></div><div className="flex flex-col items-start md:items-end text-xs text-zinc-400"><p><strong>Style:</strong> {activeImage.style} | <strong>Ratio:</strong> {activeImage.aspectRatio}</p><p><strong>Seed:</strong> {activeImage.seed} | <strong>CFG:</strong> {activeImage.cfgScale} | <strong>Steps:</strong> {activeImage.steps}</p></div></div>)}
                </div>
            </main>

            <aside className="w-full lg:w-[380px] bg-black/30 border-l border-zinc-800 p-4 flex flex-col">
                <form onSubmit={generateImage} className="flex-grow flex flex-col space-y-4">
                    <h1 className="text-xl font-bold text-white mb-2">Create</h1>
                    <div><label htmlFor="prompt" className="block text-sm font-medium text-zinc-300 mb-1">Prompt</label><textarea id="prompt" value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="A cat astronaut on Mars..." className="w-full bg-zinc-900 border border-zinc-700 rounded-md shadow-sm p-2 focus:outline-none focus:ring-1 focus:ring-indigo-500 h-28 resize-y" /></div>
                    <div><label htmlFor="negativePrompt" className="block text-sm font-medium text-zinc-300 mb-1">Negative Prompt</label><textarea id="negativePrompt" value={negativePrompt} onChange={(e) => setNegativePrompt(e.target.value)} placeholder="ugly, blurry, deformed..." className="w-full bg-zinc-900 border border-zinc-700 rounded-md shadow-sm p-2 focus:outline-none focus:ring-1 focus:ring-indigo-500 h-20 resize-y" /></div>
                    <CustomButton onClick={handleSurpriseMe} variant="secondary"><Icon path="M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.998 15.998 0 011.622-3.385m5.043.025a15.998 15.998 0 001.622-3.385m0 0a15.998 15.998 0 003.388-1.621m-4.5 5.454a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.998 15.998 0 011.622-3.385m5.043.025a15.998 15.998 0 001.622-3.385m0 0a15.998 15.998 0 003.388-1.621m-4.5 5.454a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128z" className="mr-2 h-5 w-5"/> Surprise Me</CustomButton>
                    <div className="grid grid-cols-2 gap-4"><CustomSelect label="Style" value={style} onChange={setStyle} options={["Hyperrealistic", "Anime", "Digital Painting", "Cinematic", "Retro Futurism", "Low Poly", "Comic Book", "Dark Fantasy", "Cyberpunk"]} /><CustomSelect label="Aspect Ratio" value={aspectRatio} onChange={setAspectRatio} options={["1:1", "16:9", "9:16", "4:3", "3:4"]} /></div>
                    
                    <div className="space-y-4 pt-4 border-t border-zinc-800"><button type="button" onClick={() => setShowAdvanced(!showAdvanced)} className="w-full flex justify-between items-center text-sm font-medium text-zinc-300"><span>Advanced Settings</span><Icon path={showAdvanced ? "M4.5 15.75l7.5-7.5 7.5 7.5" : "M19.5 8.25l-7.5 7.5-7.5-7.5"} className="h-5 w-5"/></button>
                        {showAdvanced && <div className="space-y-4 p-4 bg-zinc-900 rounded-lg border border-zinc-700">
                            <div><label htmlFor="seed" className="block text-sm font-medium text-zinc-300 mb-1">Seed</label><div className="flex items-center gap-2"><input type="number" id="seed" value={seed} onChange={e => setSeed(Number(e.target.value))} className="w-full bg-zinc-800 border border-zinc-700 rounded-md p-2 focus:outline-none focus:ring-1 focus:ring-indigo-500" /><Tooltip text={isSeedLocked ? 'Unlock Seed' : 'Lock Seed'}><CustomButton variant="icon" className={isSeedLocked ? '!text-indigo-500 bg-indigo-900/50' : ''} onClick={() => setIsSeedLocked(!isSeedLocked)}><Icon path={isSeedLocked ? "M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H4.5a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" : "M13.5 10.5V6.75a4.5 4.5 0 119 0v3.75M3.75 21.75h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H3.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"} className="h-5 w-5"/></CustomButton></Tooltip><Tooltip text="New Random Seed"><CustomButton variant="icon" onClick={() => setSeed(Math.floor(Math.random() * 10000000))}><Icon path="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0011.667 0l3.181-3.183m-4.991-2.695v4.992m0 0h-4.992m4.992 0l-3.181-3.183a8.25 8.25 0 00-11.667 0l-3.181 3.183" className="h-5 w-5"/></CustomButton></Tooltip></div></div>
                            <CustomSlider label="Guidance Scale (CFG)" value={cfgScale} min={1} max={20} step={0.5} onChange={e => setCfgScale(parseFloat(e.target.value))} />
                            <CustomSlider label="Inference Steps" value={steps} min={10} max={100} step={1} onChange={e => setSteps(parseInt(e.target.value))} />
                        </div>}
                    </div>
                    <CustomSelect label="Frame Style" value={frame} onChange={setFrame} options={["None", "Thin Black", "Minimalist White", "Classic Wood", "Ornate Gold"]} />
                    {error && <p className="text-sm text-red-400 bg-red-900/30 p-3 rounded-md border border-red-800">{error}</p>}
                    <div className="flex-grow"></div>
                    <div className="space-y-3 pt-4 border-t border-zinc-800">
                        <CustomButton type="submit" disabled={loading} className="w-full text-lg py-3"><Icon path="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.898 20.553L16.5 21.75l-.398-1.197a3.375 3.375 0 00-2.456-2.456L12.5 17.5l1.197-.398a3.375 3.375 0 002.456-2.456L16.5 13.5l.398 1.197a3.375 3.375 0 002.456 2.456L20.5 17.5l-1.197.398a3.375 3.375 0 00-2.456 2.456z" className="mr-2 h-5 w-5"/>{loading ? "Generating..." : "Generate"}</CustomButton>
                        <div className="grid grid-cols-2 gap-3">
                            <CustomButton variant="secondary" onClick={downloadImage} disabled={!activeImage || loading}><Icon path="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" className="mr-2 h-4 w-4"/>Download</CustomButton>
                            <CustomButton variant="secondary" onClick={() => {}} disabled={!activeImage || loading}><Icon path="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" className="mr-2 h-4 w-4"/>Upscale</CustomButton>
                        </div>
                    </div>
                </form>
            </aside>
        </div>
    );
}