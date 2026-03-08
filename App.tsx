
import React, { useState, useRef } from 'react';
import { processMangaPage } from './services/geminiService';
import { TextBlock } from './types';
import { useMangaEditor } from './hooks/useMangaEditor';
import { MangaCanvas } from './components/MangaCanvas';

const App: React.FC = () => {
  const [image, setImage] = useState<string | null>(null);
  const [blocks, setBlocks] = useState<TextBlock[]>([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [toast, setToast] = useState<{msg: string, type: 'info' | 'error'} | null>(null);
  const [fileName, setFileName] = useState<string>("manga_page");
  const [exportCount, setExportCount] = useState(0);
  
  const editor = useMangaEditor();
  const imgRef = useRef<HTMLImageElement>(null);
  const editCardsRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  const showToast = (msg: string, type: 'info' | 'error' = 'info') => {
    setToast({msg, type});
    setTimeout(() => setToast(null), 3000);
  };

  const onTranslate = async () => {
    if (!image) return;
    setLoading(true);
    try {
      const hasKey = (window.aistudio && await window.aistudio.hasSelectedApiKey()) || process.env.API_KEY || process.env.GEMINI_API_KEY;
      if (!hasKey) {
        if (window.aistudio) {
          await window.aistudio.openSelectKey();
        } else {
          throw new Error("এপিআই কি (API Key) পাওয়া যায়নি। দয়া করে সেটিংস চেক করুন।");
        }
      }
      const result = await processMangaPage(image);
      setBlocks(result.detectedTexts);
      setIsEditMode(true);
      showToast("অনুবাদ সফল হয়েছে!");
    } catch (err: any) {
      console.error("Translation Error:", err);
      let errorMessage = "অনুবাদে সমস্যা হয়েছে।";
      
      if (err.message) {
        errorMessage = err.message;
      } else if (err.status === 429) {
        errorMessage = "অতিরিক্ত রিকোয়েস্ট পাঠানো হয়েছে। দয়া করে কিছুক্ষণ পর চেষ্টা করুন।";
      } else if (err.status === 403) {
        errorMessage = "এপিআই কি (API Key) সঠিক নয় বা পারমিশন নেই।";
      }
      
      showToast(errorMessage, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    const target = e.target as HTMLElement;
    const blockPart = target.closest('[data-block-id]');
    
    if (isEditMode && blockPart) {
      const id = blockPart.getAttribute('data-block-id')!;
      setSelectedBlockId(id);
      
      const handle = target.getAttribute('data-handle');
      const block = blocks.find(b => b.id === id);
      if (block) {
        editor.setInteraction({
          type: handle ? 'resize' : 'drag',
          direction: handle || undefined,
          blockId: id,
          startPos: { x: e.clientX, y: e.clientY },
          initialBlockPos: { ...block.position }
        });
      }
      return;
    }
    if (editor.scale > 1) editor.startPanning(e.clientX, e.clientY);
    else setSelectedBlockId(null);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (editor.interaction) {
      const dx = (e.clientX - editor.interaction.startPos.x) / (editor.scale * (imgRef.current?.clientWidth || 1)) * 100;
      const dy = (e.clientY - editor.interaction.startPos.y) / (editor.scale * (imgRef.current?.clientHeight || 1)) * 100;

      setBlocks(prev => prev.map(b => {
        if (b.id !== editor.interaction?.blockId) return b;
        let newPos = { ...editor.interaction!.initialBlockPos };
        if (editor.interaction!.type === 'drag') {
          newPos.left += dx; newPos.top += dy;
        } else if (editor.interaction!.direction) {
          const dir = editor.interaction!.direction;
          if (dir.includes('e')) newPos.width = Math.max(5, editor.interaction!.initialBlockPos.width + dx);
          if (dir.includes('s')) newPos.height = Math.max(5, editor.interaction!.initialBlockPos.height + dy);
          if (dir.includes('w')) {
            const d = Math.min(editor.interaction!.initialBlockPos.width - 5, dx);
            newPos.left += d; newPos.width -= d;
          }
          if (dir.includes('n')) {
            const d = Math.min(editor.interaction!.initialBlockPos.height - 5, dy);
            newPos.top += d; newPos.height -= d;
          }
        }
        return { ...b, position: newPos };
      }));
    } else {
      editor.updatePanning(e.clientX, e.clientY);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Basic validation
      if (!file.type.startsWith('image/')) {
        showToast("দয়া করে একটি ইমেজ ফাইল নির্বাচন করুন।", 'error');
        return;
      }
      if (file.size > 10 * 1024 * 1024) { // 10MB limit
        showToast("ফাইলটি অনেক বড়। ১০ মেগাবাইটের নিচের ছবি ব্যবহার করুন।", 'error');
        return;
      }

      // Extract filename without extension
      const name = file.name.replace(/\.[^/.]+$/, "");
      setFileName(name);
      setExportCount(0); // Reset count for new file
      
      const reader = new FileReader();
      reader.onload = (ev) => {
        setImage(ev.target?.result as string);
        setBlocks([]);
        setIsEditMode(false);
        editor.setScale(1);
        editor.setOffset({ x: 0, y: 0 });
      };
      reader.onerror = () => {
        showToast("ফাইলটি পড়তে সমস্যা হয়েছে। দয়া করে আবার চেষ্টা করুন।", 'error');
      };
      reader.readAsDataURL(file);
    }
  };

  const handleExport = async () => {
    if (!image || !imgRef.current) return;
    setExporting(true);
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const img = imgRef.current;
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      ctx.drawImage(img, 0, 0);
      const previewWidth = img.clientWidth || 448;
      const scaleFactor = canvas.width / previewWidth;

      for (const block of blocks) {
        if (!block.visible || block.shape === 'none') continue;
        const x = (block.position.left / 100) * canvas.width;
        const y = (block.position.top / 100) * canvas.height;
        const w = (block.position.width / 100) * canvas.width;
        const h = (block.position.height / 100) * canvas.height;
        
        ctx.fillStyle = '#ffffff';
        const padding = 2 * scaleFactor; // Match UI inset
        
        if (block.shape === 'oval' || block.shape === 'cloud') {
          ctx.beginPath();
          // For cloud, we'll use a slightly more complex ellipse or just an ellipse for now
          // to keep it simple but effective.
          ctx.ellipse(x + w/2, y + h/2, (w/2) + padding, (h/2) + padding, 0, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // Rectangular with rounded corners
          const radius = 8 * scaleFactor;
          ctx.beginPath();
          ctx.roundRect(x - padding, y - padding, w + (padding * 2), h + (padding * 2), radius);
          ctx.fill();
        }
      }

      for (const block of blocks) {
        if (!block.visible) continue;
        const x = (block.position.left / 100) * canvas.width;
        const y = (block.position.top / 100) * canvas.height;
        const w = (block.position.width / 100) * canvas.width;
        const h = (block.position.height / 100) * canvas.height;
        
        ctx.fillStyle = block.style.fill;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        const fontSize = block.style.fontSize * scaleFactor;
        ctx.font = `${block.style.bold ? '700' : '400'} ${fontSize}px "Noto Sans Bengali"`;
        
        // Text Wrapping Logic
        const wrapText = (text: string, maxWidth: number) => {
          const lines: string[] = [];
          const paragraphs = text.split('\n');
          
          for (const paragraph of paragraphs) {
            const words = paragraph.split(' ');
            let currentLine = words[0] || "";

            for (let i = 1; i < words.length; i++) {
              const word = words[i];
              const width = ctx.measureText(currentLine + " " + word).width;
              if (width < maxWidth) {
                currentLine += (currentLine ? " " : "") + word;
              } else {
                lines.push(currentLine);
                currentLine = word;
              }
            }
            lines.push(currentLine);
          }
          return lines;
        };

        const maxWidth = w * 0.98; // 2% padding
        const lines = wrapText(block.translatedText, maxWidth);
        const lineHeight = fontSize * 1.1; // Tighter leading
        const totalHeight = lines.length * lineHeight;
        
        // Calculate starting Y to center the block of text vertically
        let currentY = y + (h - totalHeight) / 2 + lineHeight / 2;

        for (const line of lines) {
          if (block.shape === 'none') {
            ctx.strokeStyle = 'white';
            ctx.lineWidth = fontSize * 0.15;
            ctx.strokeText(line, x + w / 2, currentY);
          }
          ctx.fillText(line, x + w / 2, currentY);
          currentY += lineHeight;
        }
      }

      const finalCount = exportCount + 1;
      setExportCount(finalCount);
      
      const countStr = finalCount > 1 ? `_manga_pro_${finalCount.toString().padStart(2, '0')}` : "";
      const downloadName = `${fileName}${countStr}.png`;

      const link = document.createElement('a');
      link.download = downloadName;
      link.href = canvas.toDataURL('image/png');
      link.click();
      showToast("সেভ করা হয়েছে।");
    } catch (e) {
      showToast("সেভ ব্যর্থ হয়েছে।", 'error');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col overflow-x-hidden overflow-y-auto">
      {/* Optimized Mobile Header */}
      <header className="glass-panel sticky top-0 z-[100] px-4 py-3 flex justify-between items-center shadow-lg border-b border-white/5">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
            <span className="text-lg">🎏</span>
          </div>
          <div>
            <h1 className="text-sm font-black text-white leading-none">মাঙ্গা প্রো</h1>
            <p className="text-[9px] text-indigo-400 font-bold uppercase tracking-wider opacity-80 mt-1">Translator</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {image && blocks.length > 0 && (
            <button 
              onClick={handleExport} 
              disabled={exporting}
              className="w-9 h-9 bg-slate-800 rounded-lg flex items-center justify-center text-indigo-400 active:scale-90 transition-transform"
            >
              {exporting ? <div className="w-3 h-3 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin"></div> : <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>}
            </button>
          )}
          <button 
            onClick={() => document.getElementById('fileIn')?.click()} 
            className="h-9 px-3 bg-indigo-600 text-white rounded-lg font-bold text-xs shadow-md active:scale-95 transition-all"
          >
            আপলোড
          </button>
        </div>
      </header>

      <main className="flex-1 w-full max-w-full lg:max-w-5xl mx-auto px-4 py-6">
        {!image ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div 
              onClick={() => document.getElementById('fileIn')?.click()} 
              className="w-full max-w-xs aspect-square rounded-[2rem] border-2 border-dashed border-slate-700 bg-slate-800/20 flex flex-col items-center justify-center cursor-pointer hover:border-indigo-500 transition-all shadow-xl"
            >
              <div className="w-16 h-16 bg-slate-800 rounded-2xl flex items-center justify-center mb-4">
                <span className="text-3xl">🖼️</span>
              </div>
              <p className="text-base font-black text-slate-300">মাঙ্গা নির্বাচন করুন</p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col lg:grid lg:grid-cols-12 gap-8">
            {/* Canvas: Sticky only on Large screens */}
            <div className="lg:col-span-7 lg:sticky lg:top-24 h-fit">
              <div className="relative">
                <MangaCanvas 
                  image={image} blocks={blocks} selectedId={selectedBlockId} isEditMode={isEditMode}
                  scale={editor.scale} offset={editor.offset} imgRef={imgRef}
                  onPointerDown={handlePointerDown} onPointerMove={handlePointerMove}
                  onPointerUp={() => { editor.setIsPanning(false); editor.setInteraction(null); }}
                  onWheel={editor.handleWheel}
                  onImageError={() => {
                    showToast("ছবিটি লোড করতে সমস্যা হয়েছে। দয়া করে অন্য কোনো ছবি চেষ্টা করুন।", 'error');
                    setImage(null);
                    setBlocks([]);
                  }}
                />
              </div>

              {!blocks.length && !loading && (
                <div className="mt-8 flex justify-center">
                  <button 
                    onClick={onTranslate}
                    className="px-8 py-4 bg-indigo-600 text-white rounded-2xl font-black text-lg shadow-xl hover:scale-105 active:scale-95 transition-all flex items-center gap-3"
                  >
                    ✨ অনুবাদ শুরু করুন
                  </button>
                </div>
              )}
            </div>

            {/* Sidebar / Editor: Natural flow on mobile */}
            <div className="lg:col-span-5 space-y-4 pb-12">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-12 bg-slate-800/30 rounded-3xl border border-slate-800">
                  <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4"></div>
                  <h3 className="text-sm font-black text-white">এআই অনুবাদ করছে...</h3>
                </div>
              ) : blocks.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between px-1">
                    <h2 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest bg-indigo-400/10 px-2 py-1 rounded">
                      BLOCKS: {blocks.length}
                    </h2>
                    <button 
                      onClick={() => setIsEditMode(!isEditMode)}
                      className="text-[10px] font-bold text-slate-400 underline"
                    >
                      {isEditMode ? "প্রিভিউ দেখুন" : "এডিট মুড"}
                    </button>
                  </div>

                  {blocks.map((block, i) => (
                    <div 
                      key={block.id}
                      ref={el => editCardsRefs.current[block.id] = el}
                      className={`bg-slate-800/40 rounded-2xl border transition-all duration-200 overflow-hidden ${selectedBlockId === block.id ? 'border-indigo-500 bg-slate-800/80 ring-2 ring-indigo-500/20' : 'border-slate-800'}`}
                      onClick={() => {
                        setSelectedBlockId(block.id);
                        setIsEditMode(true);
                      }}
                    >
                      <div className="p-4 flex gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-black flex-shrink-0 ${selectedBlockId === block.id ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-500'}`}>
                          {i + 1}
                        </div>
                        <div className="flex-1">
                          <textarea 
                            value={block.translatedText}
                            onChange={(e) => setBlocks(prev => prev.map(b => b.id === block.id ? {...b, translatedText: e.target.value} : b))}
                            className="w-full bg-slate-900/60 p-3 rounded-xl text-sm font-bold text-white outline-none resize-none bengali-font leading-relaxed border border-transparent focus:border-indigo-500/30"
                            rows={2}
                          />
                            <div className="mt-2 flex items-center justify-between">
                             <span className="text-[9px] text-slate-500 italic truncate max-w-[120px]">Original: {block.originalText}</span>
                             <div className="flex flex-col items-end gap-1">
                               <div className="flex items-center gap-3">
                                 <div className="flex items-center gap-2">
                                   <span className="text-[8px] font-black text-slate-600 uppercase">Text Size</span>
                                   <input 
                                     type="range" min="6" max="48" step="1" 
                                     value={block.style.fontSize} 
                                     onChange={(e) => setBlocks(prev => prev.map(b => b.id === block.id ? {...b, style: {...b.style, fontSize: parseFloat(e.target.value)}} : b))}
                                     className="w-12 h-1 accent-indigo-500"
                                     onClick={(e) => e.stopPropagation()}
                                   />
                                 </div>
                                 <button 
                                   onClick={(e) => {
                                     e.stopPropagation();
                                     setBlocks(prev => prev.map(b => b.id === block.id ? {
                                       ...b, 
                                       style: { ...b.style, bold: !b.style.bold, fontWeight: !b.style.bold ? '700' : '400' }
                                     } : b));
                                   }}
                                   className={`px-2 py-0.5 rounded text-[8px] font-black uppercase transition-all ${block.style.bold ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'}`}
                                 >
                                   Bold
                                 </button>
                               </div>
                               <button 
                                 onClick={(e) => {
                                   e.stopPropagation();
                                   setBlocks(prev => prev.map(b => ({
                                     ...b, 
                                     style: { 
                                       ...b.style, 
                                       fontSize: block.style.fontSize,
                                       bold: block.style.bold,
                                       fontWeight: block.style.fontWeight
                                     }
                                   })));
                                   showToast("সবগুলোতে স্টাইল অ্যাপ্লাই করা হয়েছে।");
                                 }}
                                 className="text-[8px] font-bold text-indigo-400 hover:text-indigo-300 transition-colors"
                               >
                                 Apply to all
                               </button>
                             </div>
                           </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      <input type="file" id="fileIn" className="hidden" onChange={handleFileChange} accept="image/*" />
      
      {toast && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 px-5 py-2.5 rounded-xl text-[10px] font-black shadow-2xl z-[200] flex items-center gap-2 animate-in fade-in slide-in-from-bottom-4 duration-300 ${toast.type === 'error' ? 'bg-rose-500 text-white' : 'bg-slate-900 text-white border border-white/10'}`}>
          <div className="w-1.5 h-1.5 rounded-full bg-current animate-pulse"></div>
          {toast.msg}
        </div>
      )}
    </div>
  );
};

export default App;
