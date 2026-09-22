import React, { useState, useRef, useEffect } from 'react';
import { Link2, Upload, Paintbrush, RotateCcw, Eraser, Check, Image as ImageIcon, Sparkles, Trash2 } from 'lucide-react';
import { TouchSafeButton } from './TouchSafeButton';
import { SkinItem } from '../data/skinsData';

interface CustomSkinBuilderProps {
  onSaveSkin: (skin: SkinItem) => void;
}

const COLOR_PRESETS = [
  '#ef4444', '#f97316', '#facc15', '#22c55e', '#06b6d4', 
  '#3b82f6', '#a855f7', '#ec4899', '#ffffff', '#0f172a'
];

const BG_COLOR_PRESETS = [
  '#0f172a', '#1e1b4b', '#3b0764', '#052e16', '#450a0a', 
  '#1c1917', '#ffffff', '#0284c7', '#7c2d12', '#000000'
];

const BORDER_COLOR_PRESETS = [
  '#38bdf8', '#4ade80', '#facc15', '#f43f5e', '#c084fc', 
  '#fb923c', '#ffffff', '#64748b', '#10b981', '#e11d48'
];

export const CustomSkinBuilder: React.FC<CustomSkinBuilderProps> = ({ onSaveSkin }) => {
  const [activeMode, setActiveMode] = useState<'url' | 'upload' | 'draw'>('draw');

  // URL state
  const [urlInput, setUrlInput] = useState('');
  const [urlPreviewValid, setUrlPreviewValid] = useState(true);

  // Upload state
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Draw state
  const [penColor, setPenColor] = useState('#ffffff');
  const [bgColor, setBgColor] = useState('#1e293b');
  const [borderColor, setBorderColor] = useState('#38bdf8');
  const [brushSize, setBrushSize] = useState(8);
  const [isEraser, setIsEraser] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const undoStackRef = useRef<ImageData[]>([]);

  // Skin name
  const [skinName, setSkinName] = useState('');

  // Initial draw canvas setup
  useEffect(() => {
    if (activeMode === 'draw' && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx && undoStackRef.current.length === 0) {
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        saveUndoState();
      }
    }
  }, [activeMode]);

  const saveUndoState = () => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;
    if (undoStackRef.current.length > 15) {
      undoStackRef.current.shift();
    }
    undoStackRef.current.push(ctx.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height));
  };

  const handleUndo = () => {
    if (!canvasRef.current || undoStackRef.current.length <= 1) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;
    undoStackRef.current.pop(); // Pop current state
    const previousState = undoStackRef.current[undoStackRef.current.length - 1];
    if (previousState) {
      ctx.putImageData(previousState, 0, 0);
    }
  };

  const handleClear = () => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    saveUndoState();
  };

  const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    if ('touches' in e) {
      const touch = e.touches[0] || (e as React.TouchEvent).changedTouches[0];
      return {
        x: (touch.clientX - rect.left) * scaleX,
        y: (touch.clientY - rect.top) * scaleY
      };
    } else {
      return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY
      };
    }
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if ('touches' in e && e.touches.length > 1) return;
    if ('touches' in e) e.preventDefault();

    isDrawingRef.current = true;
    const coords = getCanvasCoords(e);
    lastPointRef.current = coords;

    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    ctx.beginPath();
    ctx.arc(coords.x, coords.y, brushSize / 2, 0, Math.PI * 2);
    ctx.fillStyle = isEraser ? 'rgba(0,0,0,1)' : penColor;
    ctx.globalCompositeOperation = isEraser ? 'destination-out' : 'source-over';
    ctx.fill();
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current || !canvasRef.current || !lastPointRef.current) return;
    if ('touches' in e) e.preventDefault();

    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    const currentPoint = getCanvasCoords(e);

    ctx.beginPath();
    ctx.moveTo(lastPointRef.current.x, lastPointRef.current.y);
    ctx.lineTo(currentPoint.x, currentPoint.y);
    ctx.strokeStyle = isEraser ? 'rgba(0,0,0,1)' : penColor;
    ctx.lineWidth = brushSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalCompositeOperation = isEraser ? 'destination-out' : 'source-over';
    ctx.stroke();

    lastPointRef.current = currentPoint;
  };

  const stopDrawing = () => {
    if (isDrawingRef.current) {
      isDrawingRef.current = false;
      lastPointRef.current = null;
      saveUndoState();
    }
  };

  // Upload handler
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setUploadedImage(event.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Save handler
  const handleSave = () => {
    const defaultName = skinName.trim() || `Custom ${activeMode.toUpperCase()}`;

    if (activeMode === 'url') {
      if (!urlInput.trim()) return;
      onSaveSkin({
        id: `custom-url-${Date.now()}`,
        name: defaultName,
        category: 'custom',
        svg: urlInput.trim(),
        border: '#38bdf8',
        bg: '#0f172a'
      });
      setUrlInput('');
      setSkinName('');
    } else if (activeMode === 'upload') {
      if (!uploadedImage) return;
      onSaveSkin({
        id: `custom-upload-${Date.now()}`,
        name: defaultName,
        category: 'custom',
        svg: uploadedImage,
        border: '#38bdf8',
        bg: '#0f172a'
      });
      setUploadedImage(null);
      setSkinName('');
    } else if (activeMode === 'draw') {
      if (!canvasRef.current) return;
      
      // Render final composite image onto a square output canvas
      const outputCanvas = document.createElement('canvas');
      outputCanvas.width = 240;
      outputCanvas.height = 240;
      const ctx = outputCanvas.getContext('2d');
      if (!ctx) return;

      // Draw circular background
      ctx.beginPath();
      ctx.arc(120, 120, 114, 0, Math.PI * 2);
      ctx.fillStyle = bgColor;
      ctx.fill();

      // Clip inside circle and draw user drawing
      ctx.save();
      ctx.beginPath();
      ctx.arc(120, 120, 114, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(canvasRef.current, 0, 0, 240, 240);
      ctx.restore();

      // Draw border
      ctx.beginPath();
      ctx.arc(120, 120, 114, 0, Math.PI * 2);
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = 10;
      ctx.stroke();

      const finalDataUrl = outputCanvas.toDataURL('image/png');

      onSaveSkin({
        id: `custom-draw-${Date.now()}`,
        name: defaultName,
        category: 'custom',
        svg: finalDataUrl,
        border: borderColor,
        bg: bgColor
      });

      handleClear();
      setSkinName('');
    }
  };

  return (
    <div className="w-full bg-[#111728] border-b border-[#1c2438] p-3 sm:p-4 flex flex-col gap-3 shrink-0">
      {/* Sub-Option Mode Toggle */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex bg-[#0b101e] p-1 rounded-xl border border-slate-800 gap-1 flex-1 max-w-md">
          <TouchSafeButton
            onClick={() => setActiveMode('draw')}
            className={`flex-1 py-1.5 px-3 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition-all ${
              activeMode === 'draw'
                ? 'bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-md shadow-sky-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Paintbrush size={15} className="pointer-events-none" />
            <span>Draw Skin</span>
          </TouchSafeButton>

          <TouchSafeButton
            onClick={() => setActiveMode('upload')}
            className={`flex-1 py-1.5 px-3 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition-all ${
              activeMode === 'upload'
                ? 'bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-md shadow-sky-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Upload size={15} className="pointer-events-none" />
            <span>Upload Image</span>
          </TouchSafeButton>

          <TouchSafeButton
            onClick={() => setActiveMode('url')}
            className={`flex-1 py-1.5 px-3 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition-all ${
              activeMode === 'url'
                ? 'bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-md shadow-sky-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Link2 size={15} className="pointer-events-none" />
            <span>Paste URL</span>
          </TouchSafeButton>
        </div>

        {/* Optional Skin Name & Save CTA on desktop/wide */}
        <div className="hidden sm:flex items-center gap-2">
          <input
            type="text"
            placeholder="Skin Name (optional)"
            value={skinName}
            onChange={(e) => setSkinName(e.target.value)}
            className="bg-[#0b101e] border border-slate-700 text-white text-xs px-3 py-1.5 rounded-lg w-40 focus:outline-none focus:border-sky-400"
          />
          <TouchSafeButton
            onClick={handleSave}
            className="bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-white font-bold text-xs px-4 py-1.5 rounded-lg shadow-md shadow-emerald-500/20 flex items-center gap-1.5"
          >
            <Sparkles size={14} className="pointer-events-none" />
            <span>Save Skin</span>
          </TouchSafeButton>
        </div>
      </div>

      {/* Mode Specific Body */}
      {activeMode === 'url' && (
        <div className="flex flex-col sm:flex-row items-center gap-4 bg-[#0b101e] p-3 rounded-xl border border-slate-800/80">
          {/* Live Preview */}
          <div className="flex flex-col items-center gap-1 shrink-0">
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-slate-900 border-[3px] border-sky-400 shadow-inner flex items-center justify-center overflow-hidden relative">
              {urlInput.trim() && urlPreviewValid ? (
                <img
                  src={urlInput.trim()}
                  alt="URL Preview"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                  onError={() => setUrlPreviewValid(false)}
                  onLoad={() => setUrlPreviewValid(true)}
                />
              ) : (
                <div className="flex flex-col items-center justify-center text-slate-500 p-2 text-center">
                  <Link2 size={24} className="text-slate-600 mb-1" />
                  <span className="text-[9px] font-bold">No Image</span>
                </div>
              )}
            </div>
            <span className="text-[10px] text-slate-400 font-bold">Preview</span>
          </div>

          {/* Controls */}
          <div className="flex-1 flex flex-col gap-2 w-full">
            <label className="text-xs font-bold text-slate-300">Image Web Address (URL):</label>
            <div className="flex gap-2">
              <input
                type="url"
                placeholder="https://example.com/skin-image.png"
                value={urlInput}
                onChange={(e) => {
                  setUrlInput(e.target.value);
                  setUrlPreviewValid(true);
                }}
                className="flex-1 bg-[#161d2d] border border-slate-700 text-white text-xs px-3 py-2 rounded-lg focus:outline-none focus:border-sky-400"
              />
            </div>
            {!urlPreviewValid && (
              <span className="text-xs text-rose-400 font-medium">Unable to load image from this URL. Make sure it links directly to a PNG, JPG, or SVG image.</span>
            )}
            <div className="sm:hidden flex gap-2 mt-1">
              <input
                type="text"
                placeholder="Skin Name (optional)"
                value={skinName}
                onChange={(e) => setSkinName(e.target.value)}
                className="flex-1 bg-[#161d2d] border border-slate-700 text-white text-xs px-3 py-1.5 rounded-lg focus:outline-none focus:border-sky-400"
              />
              <TouchSafeButton
                onClick={handleSave}
                className="bg-emerald-500 hover:bg-emerald-400 text-white font-bold text-xs px-4 py-1.5 rounded-lg shadow-md flex items-center gap-1.5 shrink-0"
              >
                <Sparkles size={14} className="pointer-events-none" />
                <span>Save</span>
              </TouchSafeButton>
            </div>
          </div>
        </div>
      )}

      {activeMode === 'upload' && (
        <div className="flex flex-col sm:flex-row items-center gap-4 bg-[#0b101e] p-3 rounded-xl border border-slate-800/80">
          {/* Live Preview */}
          <div className="flex flex-col items-center gap-1 shrink-0">
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-slate-900 border-[3px] border-sky-400 shadow-inner flex items-center justify-center overflow-hidden relative">
              {uploadedImage ? (
                <img
                  src={uploadedImage}
                  alt="Uploaded Preview"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="flex flex-col items-center justify-center text-slate-500 p-2 text-center">
                  <ImageIcon size={24} className="text-slate-600 mb-1" />
                  <span className="text-[9px] font-bold">No File</span>
                </div>
              )}
            </div>
            <span className="text-[10px] text-slate-400 font-bold">Preview</span>
          </div>

          {/* Controls */}
          <div className="flex-1 flex flex-col gap-2 w-full">
            <label className="text-xs font-bold text-slate-300">Select Image from Device:</label>
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />
            <div className="flex items-center gap-3">
              <TouchSafeButton
                onClick={() => fileInputRef.current?.click()}
                className="bg-slate-700 hover:bg-slate-600 border border-slate-500 text-white font-bold text-xs px-4 py-2 rounded-lg flex items-center gap-2 shadow"
              >
                <Upload size={16} className="pointer-events-none" />
                <span>Choose Image File...</span>
              </TouchSafeButton>
              <span className="text-[11px] text-slate-400">
                {uploadedImage ? 'Image selected & cropped to circle' : 'PNG, JPG, SVG, WebP supported'}
              </span>
            </div>
            <div className="sm:hidden flex gap-2 mt-1">
              <input
                type="text"
                placeholder="Skin Name (optional)"
                value={skinName}
                onChange={(e) => setSkinName(e.target.value)}
                className="flex-1 bg-[#161d2d] border border-slate-700 text-white text-xs px-3 py-1.5 rounded-lg focus:outline-none focus:border-sky-400"
              />
              <TouchSafeButton
                onClick={handleSave}
                className="bg-emerald-500 hover:bg-emerald-400 text-white font-bold text-xs px-4 py-1.5 rounded-lg shadow-md flex items-center gap-1.5 shrink-0"
              >
                <Sparkles size={14} className="pointer-events-none" />
                <span>Save</span>
              </TouchSafeButton>
            </div>
          </div>
        </div>
      )}

      {activeMode === 'draw' && (
        <div className="flex flex-col md:flex-row items-center gap-4 bg-[#0b101e] p-3 rounded-xl border border-slate-800/80">
          {/* Drawing Canvas (Interactive) */}
          <div className="flex flex-col items-center gap-1 shrink-0">
            <div 
              className="relative w-32 h-32 sm:w-36 sm:h-36 rounded-full shadow-lg flex items-center justify-center overflow-hidden"
              style={{
                backgroundColor: bgColor,
                border: `5px solid ${borderColor}`,
                touchAction: 'none'
              }}
            >
              <canvas
                ref={canvasRef}
                width={240}
                height={240}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
                className="w-full h-full cursor-crosshair"
                style={{ touchAction: 'none' }}
              />
            </div>
            <span className="text-[10px] text-slate-400 font-bold">Draw Directly Inside Circle</span>
          </div>

          {/* Drawing Tools & Palettes */}
          <div className="flex-1 flex flex-col gap-2.5 w-full">
            {/* Top Toolbar: Brush, Eraser, Size, Undo, Clear */}
            <div className="flex flex-wrap items-center gap-2 justify-between">
              <div className="flex items-center gap-1.5">
                <TouchSafeButton
                  onClick={() => setIsEraser(false)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 transition-all ${
                    !isEraser ? 'bg-sky-500 text-white shadow' : 'bg-[#161d2d] text-slate-400 border border-slate-700'
                  }`}
                >
                  <Paintbrush size={14} className="pointer-events-none" />
                  <span>Pen</span>
                </TouchSafeButton>

                <TouchSafeButton
                  onClick={() => setIsEraser(true)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 transition-all ${
                    isEraser ? 'bg-rose-500 text-white shadow' : 'bg-[#161d2d] text-slate-400 border border-slate-700'
                  }`}
                >
                  <Eraser size={14} className="pointer-events-none" />
                  <span>Eraser</span>
                </TouchSafeButton>

                <div className="flex items-center gap-1 bg-[#161d2d] px-2 py-1 rounded-lg border border-slate-700">
                  <span className="text-[10px] font-bold text-slate-400">Size:</span>
                  {[4, 8, 14, 22].map((size) => (
                    <button
                      key={size}
                      onClick={() => setBrushSize(size)}
                      className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${
                        brushSize === size ? 'bg-sky-400 text-slate-900 font-black' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {size === 4 ? 'S' : size === 8 ? 'M' : size === 14 ? 'L' : 'XL'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <TouchSafeButton
                  onClick={handleUndo}
                  className="bg-[#161d2d] hover:bg-slate-700 border border-slate-700 text-slate-300 px-2 py-1 rounded-lg text-xs font-bold flex items-center gap-1"
                >
                  <RotateCcw size={13} className="pointer-events-none" />
                  <span>Undo</span>
                </TouchSafeButton>

                <TouchSafeButton
                  onClick={handleClear}
                  className="bg-[#161d2d] hover:bg-rose-900/40 border border-slate-700 text-rose-400 px-2 py-1 rounded-lg text-xs font-bold flex items-center gap-1"
                >
                  <Trash2 size={13} className="pointer-events-none" />
                  <span>Clear</span>
                </TouchSafeButton>
              </div>
            </div>

            {/* Color Rows: Pen Color, Background Color, Border Color */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 bg-[#161d2d] p-2 rounded-xl border border-slate-800">
              {/* Pen Color */}
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-300">Pen Color:</span>
                  <input
                    type="color"
                    value={penColor}
                    onChange={(e) => {
                      setPenColor(e.target.value);
                      setIsEraser(false);
                    }}
                    className="w-4 h-4 rounded cursor-pointer border-0 bg-transparent"
                  />
                </div>
                <div className="flex gap-1 flex-wrap">
                  {COLOR_PRESETS.slice(0, 7).map((color) => (
                    <button
                      key={color}
                      onClick={() => {
                        setPenColor(color);
                        setIsEraser(false);
                      }}
                      className={`w-4 h-4 rounded-full border transition-transform ${
                        penColor === color && !isEraser ? 'scale-125 border-white shadow-sm' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              {/* Background Color */}
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-300">Fill Background:</span>
                  <input
                    type="color"
                    value={bgColor}
                    onChange={(e) => setBgColor(e.target.value)}
                    className="w-4 h-4 rounded cursor-pointer border-0 bg-transparent"
                  />
                </div>
                <div className="flex gap-1 flex-wrap">
                  {BG_COLOR_PRESETS.slice(0, 7).map((color) => (
                    <button
                      key={color}
                      onClick={() => setBgColor(color)}
                      className={`w-4 h-4 rounded-full border transition-transform ${
                        bgColor === color ? 'scale-125 border-white shadow-sm' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              {/* Border Color */}
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-300">Border Ring:</span>
                  <input
                    type="color"
                    value={borderColor}
                    onChange={(e) => setBorderColor(e.target.value)}
                    className="w-4 h-4 rounded cursor-pointer border-0 bg-transparent"
                  />
                </div>
                <div className="flex gap-1 flex-wrap">
                  {BORDER_COLOR_PRESETS.slice(0, 7).map((color) => (
                    <button
                      key={color}
                      onClick={() => setBorderColor(color)}
                      className={`w-4 h-4 rounded-full border transition-transform ${
                        borderColor === color ? 'scale-125 border-white shadow-sm' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Mobile save button */}
            <div className="sm:hidden flex gap-2 mt-1">
              <input
                type="text"
                placeholder="Skin Name (optional)"
                value={skinName}
                onChange={(e) => setSkinName(e.target.value)}
                className="flex-1 bg-[#161d2d] border border-slate-700 text-white text-xs px-3 py-1.5 rounded-lg focus:outline-none focus:border-sky-400"
              />
              <TouchSafeButton
                onClick={handleSave}
                className="bg-emerald-500 hover:bg-emerald-400 text-white font-bold text-xs px-4 py-1.5 rounded-lg shadow-md flex items-center gap-1.5 shrink-0"
              >
                <Sparkles size={14} className="pointer-events-none" />
                <span>Save</span>
              </TouchSafeButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
