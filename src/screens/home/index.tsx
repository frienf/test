import { ColorSwatch, Group } from '@mantine/core';
import { Button } from '@/components/ui/button';
import { useEffect, useRef, useState, useCallback } from 'react';
import axios from 'axios';
import Draggable, { DraggableEvent } from 'react-draggable';
import Tesseract from 'tesseract.js';
import { SWATCHES } from '@/constants';
import { Menu, X, RotateCcw, RotateCw, History, Play, Palette, Eraser, Minus, Plus, Layout, Text, Sun, Moon, Check, Loader2 } from 'lucide-react';

interface GeneratedResult {
    expression: string;
    answer: string;
}

interface Response {
    expr: string;
    result: string;
    assign: boolean;
}

export default function Home() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [canvasPosition, setCanvasPosition] = useState({ x: 0, y: 0 });
    const [canvasSize, setCanvasSize] = useState({ width: window.innerWidth, height: window.innerHeight });
    const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });
    const [color, setColor] = useState('#ffffff');
    const [reset, setReset] = useState(false);
    const [dictOfVars, setDictOfVars] = useState<Record<string, string>>({});
    const [latexPosition, setLatexPosition] = useState({ x: 10, y: 200 });
    const [latexExpression, setLatexExpression] = useState<Array<string>>([]);
    const [history, setHistory] = useState<ImageData[]>([]);
    const [historyIndex, setHistoryIndex] = useState(-1);
    const [calculationHistory, setCalculationHistory] = useState<GeneratedResult[]>([]);
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [lineWidth, setLineWidth] = useState(3);
    const [isEraser, setIsEraser] = useState(false);
    const [showColorPalette, setShowColorPalette] = useState(false);
    const [isDrawingShape, setIsDrawingShape] = useState(false);
    const [currentShape, setCurrentShape] = useState<{
        type: 'rectangle' | 'circle' | 'line' | 'triangle' | null;
        startX: number;
        startY: number;
    }>({ type: null, startX: 0, startY: 0 });
    const [isScratching, setIsScratching] = useState(false);
    const [scratchPoints, setScratchPoints] = useState<{ x: number; y: number }[]>([]);
    const [isHovering, setIsHovering] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [zoomLevel, setZoomLevel] = useState(1);
    const [backgroundStyle, setBackgroundStyle] = useState<{ type: string; value: string; label: string }>(
        { type: 'color', value: 'transparent', label: 'Transparent' }
    );
    const [showBackgrounds, setShowBackgrounds] = useState(false);
    const [convertedText, setConvertedText] = useState('');
    const [isDarkMode, setIsDarkMode] = useState(false);
    const [shapeTimer, setShapeTimer] = useState<NodeJS.Timeout | null>(null);

    const backgrounds = [
        { type: 'color', value: 'transparent', label: 'Transparent' },
        { type: 'color', value: '#ffffff', label: 'White' },
        { type: 'color', value: '#f0f0f0', label: 'Light Gray' },
        { type: 'pattern', value: 'grid', label: 'Grid' },
        { type: 'pattern', value: 'dots', label: 'Dots' },
    ];

    // Maximum canvas size to prevent memory issues
    const MAX_CANVAS_SIZE = 50000; // 50,000 pixels
    const MAX_HISTORY_ENTRIES = 50; // Limit history to prevent memory bloat

    // Load calculation history from localStorage
    useEffect(() => {
        try {
            const savedHistory = localStorage.getItem('calculationHistory');
            if (savedHistory) {
                setCalculationHistory(JSON.parse(savedHistory));
            }
        } catch (error) {
            console.error('Failed to load calculation history:', error);
        }
    }, []);

    // Save calculation history to localStorage
    useEffect(() => {
        try {
            localStorage.setItem('calculationHistory', JSON.stringify(calculationHistory));
        } catch (error) {
            console.error('Failed to save calculation history:', error);
        }
    }, [calculationHistory]);

    // Handle MathJax typesetting
    useEffect(() => {
        if (latexExpression.length > 0 && window.MathJax) {
            setTimeout(() => {
                window.MathJax.Hub.Queue(["Typeset", window.MathJax.Hub]);
            }, 0);
        }
    }, [latexExpression]);

    // Handle reset
    useEffect(() => {
        if (reset) {
            resetCanvas();
            setLatexExpression([]);
            setDictOfVars({});
            setHistory([]);
            setHistoryIndex(-1);
            setIsHistoryOpen(false);
            setCanvasPosition({ x: 0, y: 0 });
            setCanvasSize({ width: window.innerWidth, height: window.innerHeight });
            setZoomLevel(1);
            setBackgroundStyle({ type: 'color', value: 'transparent', label: 'Transparent' });
            setConvertedText('');
            setReset(false);
        }
    }, [reset]);

    // Keyboard shortcut for history panel (Ctrl+H)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.ctrlKey && e.key === 'h') {
                e.preventDefault();
                setIsHistoryOpen((prev) => !prev);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    // Initialize canvas, MathJax, and SVG patterns
    useEffect(() => {
        const canvas = canvasRef.current;
        if (canvas) {
            const ctx = canvas.getContext('2d');
            if (ctx) {
                canvas.width = window.innerWidth;
                canvas.height = window.innerHeight - canvas.offsetTop;
                setCanvasSize({ width: canvas.width, height: canvas.height });
                ctx.lineCap = 'round';
                ctx.lineWidth = lineWidth;
                const initialState = ctx.getImageData(0, 0, canvas.width, canvas.height);
                setHistory([initialState]);
                setHistoryIndex(0);
            }
        }

        // Load MathJax
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/mathjax/2.7.9/MathJax.js?config=TeX-MML-AM_CHTML';
        script.async = true;
        document.head.appendChild(script);
        script.onload = () => {
            window.MathJax.Hub.Config({
                tex2jax: { inlineMath: [['$', '$'], ['\\(', '\\)']] },
            });
        };

        // Create SVG for patterns
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('width', '0');
        svg.setAttribute('height', '0');
        svg.innerHTML = `
            <defs>
                <pattern id="gridPattern" width="20" height="20" patternUnits="userSpaceOnUse">
                    <path d="M 20 0 L 0 0 0 20" fill="none" stroke="gray" stroke-width="0.5"/>
                </pattern>
                <pattern id="dotPattern" width="10" height="10" patternUnits="userSpaceOnUse">
                    <circle cx="5" cy="5" r="1" fill="gray"/>
                </pattern>
            </defs>
        `;
        document.body.appendChild(svg);

        return () => {
            document.head.removeChild(script);
            document.body.removeChild(svg);
        };
    }, []);

    // Update line width
    useEffect(() => {
        const canvas = canvasRef.current;
        if (canvas) {
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.lineWidth = lineWidth;
            }
        }
    }, [lineWidth]);

    // Handle dark mode and canvas background
    useEffect(() => {
        const canvas = canvasRef.current;
        if (canvas) {
            const ctx = canvas.getContext('2d');
            if (ctx) {
                if (backgroundStyle.type === 'color') {
                    canvas.style.background = isDarkMode ? '#1a1a1a' : backgroundStyle.value;
                } else if (backgroundStyle.type === 'pattern') {
                    ctx.fillStyle = isDarkMode ? '#1a1a1a' : '#ffffff';
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                    ctx.fillStyle = backgroundStyle.value === 'grid' ? 'url(#gridPattern)' : 'url(#dotPattern)';
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                }
                setColor(isDarkMode ? '#ffffff' : '#000000');
            }
        }
    }, [backgroundStyle, isDarkMode]);

    // Dark mode system preference
    useEffect(() => {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        const handleChange = (e: MediaQueryListEvent) => {
            setIsDarkMode(e.matches);
            document.documentElement.classList.toggle('dark', e.matches);
        };
        setIsDarkMode(mediaQuery.matches);
        document.documentElement.classList.toggle('dark', mediaQuery.matches);
        mediaQuery.addEventListener('change', handleChange);
        return () => mediaQuery.removeEventListener('change', handleChange);
    }, []);

    // Zoom wheel event
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const handleWheel = (e: WheelEvent) => {
            if (e.ctrlKey) {
                e.preventDefault();
                setZoomLevel(prev => Math.max(0.5, Math.min(3, prev + (e.deltaY > 0 ? -0.05 : 0.05))));
            }
        };

        canvas.addEventListener('wheel', handleWheel, { passive: false });
        return () => canvas.removeEventListener('wheel', handleWheel);
    }, [canvasRef]);

    // Expand canvas when needed
    const expandCanvas = useCallback((adjustedX: number, adjustedY: number) => {
        const canvas = canvasRef.current;
        if (!canvas) return false;

        const ctx = canvas.getContext('2d');
        if (!ctx) return false;

        // Dynamic buffer: 10% of canvas size, minimum 50px, maximum 200px
        const bufferX = Math.max(50, Math.min(200, canvasSize.width * 0.1));
        const bufferY = Math.max(50, Math.min(200, canvasSize.height * 0.1));
        let newWidth = canvasSize.width;
        let newHeight = canvasSize.height;
        let offsetX = 0;
        let offsetY = 0;
        let needsExpansion = false;

        // Check if near edges or beyond bounds
        if (adjustedX < bufferX) {
            offsetX = bufferX * 2;
            newWidth += offsetX;
            needsExpansion = true;
        } else if (adjustedX > newWidth - bufferX) {
            newWidth += bufferX * 2;
            needsExpansion = true;
        }
        if (adjustedY < bufferY) {
            offsetY = bufferY * 2;
            newHeight += offsetY;
            needsExpansion = true;
        } else if (adjustedY > newHeight - bufferY) {
            newHeight += bufferY * 2;
            needsExpansion = true;
        }

        // Limit maximum size
        if (newWidth > MAX_CANVAS_SIZE || newHeight > MAX_CANVAS_SIZE) {
            console.warn('Canvas size limit reached:', newWidth, newHeight);
            return false;
        }

        if (needsExpansion) {
            // Save current content
            const currentContent = ctx.getImageData(0, 0, canvasSize.width, canvasSize.height);

            // Resize canvas
            canvas.width = newWidth;
            canvas.height = newHeight;
            setCanvasSize({ width: newWidth, height: newHeight });

            // Restore context settings
            ctx.lineCap = 'round';
            ctx.lineWidth = lineWidth;
            ctx.strokeStyle = isEraser ? 'black' : color;

            // Redraw background for patterns
            if (backgroundStyle.type === 'pattern') {
                ctx.fillStyle = isDarkMode ? '#1a1a1a' : '#ffffff';
                ctx.fillRect(0, 0, newWidth, newHeight);
                ctx.fillStyle = backgroundStyle.value === 'grid' ? 'url(#gridPattern)' : 'url(#dotPattern)';
                ctx.fillRect(0, 0, newWidth, newHeight);
            }

            // Restore content with offset
            ctx.putImageData(currentContent, offsetX, offsetY);

            // Update canvas position to account for offset
            setCanvasPosition(prev => ({
                x: prev.x + offsetX * zoomLevel,
                y: prev.y + offsetY * zoomLevel,
            }));

            // Update history
            const newImageData = ctx.getImageData(0, 0, newWidth, newHeight);
            const newHistory = history.slice(0, historyIndex + 1);
            if (newHistory.length >= MAX_HISTORY_ENTRIES) {
                newHistory.shift(); // Remove oldest entry
            }
            setHistory([...newHistory, newImageData]);
            setHistoryIndex(newHistory.length);

            return true;
        }
        return false;
    }, [canvasSize, lineWidth, isEraser, color, backgroundStyle, isDarkMode, zoomLevel, history, historyIndex]);

    const renderLatexToCanvas = useCallback((expression: string, answer: string) => {
        const latex = `\\(\\LARGE{${expression} = ${answer}}\\)`;
        setLatexExpression((prev) => [...prev, latex]);
        const canvas = canvasRef.current;
        if (canvas) {
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                if (history[historyIndex]) {
                    ctx.putImageData(history[historyIndex], 0, 0);
                }
            }
        }
    }, [history, historyIndex]);

    const resetCanvas = () => {
        const canvas = canvasRef.current;
        if (canvas) {
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                const initialState = ctx.getImageData(0, 0, canvas.width, canvas.height);
                setHistory([initialState]);
                setHistoryIndex(0);
            }
        }
    };

    const startDragging = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (e.shiftKey) {
            setIsDragging(true);
            setLastMousePos({ x: e.clientX, y: e.clientY });
            e.preventDefault();
        }
    };

    const dragCanvas = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (isDragging) {
            const canvas = canvasRef.current;
            if (!canvas) return;

            const deltaX = e.clientX - lastMousePos.x;
            const deltaY = e.clientY - lastMousePos.y;
            const newCanvasX = canvasPosition.x + deltaX;
            const newCanvasY = canvasPosition.y + deltaY;

            // Check if dragging requires canvas expansion
            const rect = canvas.getBoundingClientRect();
            const adjustedX = (e.clientX - rect.left - newCanvasX) / zoomLevel;
            const adjustedY = (e.clientY - rect.top - newCanvasY) / zoomLevel;
            expandCanvas(adjustedX, adjustedY);

            // Update position
            setCanvasPosition({ x: newCanvasX, y: newCanvasY });
            setLastMousePos({ x: e.clientX, y: e.clientY });
        }
    };

    const stopDragging = () => {
        setIsDragging(false);
    };

    const saveCanvasState = useCallback(() => {
        const canvas = canvasRef.current;
        if (canvas) {
            const ctx = canvas.getContext('2d');
            if (ctx) {
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const newHistory = history.slice(0, historyIndex + 1);
                if (newHistory.length >= MAX_HISTORY_ENTRIES) {
                    newHistory.shift(); // Remove oldest entry
                }
                setHistory([...newHistory, imageData]);
                setHistoryIndex(newHistory.length);
            }
        }
    }, [history, historyIndex]);

    const undo = () => {
        if (historyIndex > 0) {
            const canvas = canvasRef.current;
            if (canvas) {
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    setHistoryIndex(historyIndex - 1);
                    const prevState = history[historyIndex - 1];
                    canvas.width = prevState.width;
                    canvas.height = prevState.height;
                    setCanvasSize({ width: prevState.width, height: prevState.height });
                    ctx.putImageData(prevState, 0, 0);
                }
            }
        }
    };

    const redo = () => {
        if (historyIndex < history.length - 1) {
            const canvas = canvasRef.current;
            if (canvas) {
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    setHistoryIndex(historyIndex + 1);
                    const nextState = history[historyIndex + 1];
                    canvas.width = nextState.width;
                    canvas.height = nextState.height;
                    setCanvasSize({ width: nextState.width, height: nextState.height });
                    ctx.putImageData(nextState, 0, 0);
                }
            }
        }
    };

    const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (e.shiftKey) return;
        const canvas = canvasRef.current;
        if (canvas) {
            const ctx = canvas.getContext('2d');
            if (ctx) {
                const rect = canvas.getBoundingClientRect();
                const adjustedX = (e.clientX - rect.left - canvasPosition.x) / zoomLevel;
                const adjustedY = (e.clientY - rect.top - canvasPosition.y) / zoomLevel;

                // Expand canvas if needed
                expandCanvas(adjustedX, adjustedY);

                if (e.altKey) {
                    setIsDrawingShape(true);
                    setCurrentShape({ type: null, startX: adjustedX, startY: adjustedY });
                } else if (e.ctrlKey) {
                    setIsScratching(true);
                    setScratchPoints([{ x: adjustedX, y: adjustedY }]);
                } else {
                    ctx.beginPath();
                    ctx.moveTo(adjustedX, adjustedY);
                    setIsDrawing(true);
                }
            }
        }
    };

    const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const rect = canvas.getBoundingClientRect();
        const adjustedX = (e.clientX - rect.left - canvasPosition.x) / zoomLevel;
        const adjustedY = (e.clientY - rect.top - canvasPosition.y) / zoomLevel;

        // Expand canvas if needed
        expandCanvas(adjustedX, adjustedY);

        if (isDrawingShape) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            if (history[historyIndex]) {
                ctx.putImageData(history[historyIndex], 0, 0);
            }
            ctx.strokeStyle = color;
            ctx.lineWidth = lineWidth;
            const { startX, startY } = currentShape;
            const width = adjustedX - startX;
            const height = adjustedY - startY;
            if (currentShape.type === 'rectangle') {
                ctx.strokeRect(startX, startY, width, height);
            } else if (currentShape.type === 'circle') {
                const radius = Math.sqrt(width * width + height * height);
                ctx.beginPath();
                ctx.arc(startX, startY, radius, 0, Math.PI * 2);
                ctx.stroke();
            } else if (currentShape.type === 'line') {
                ctx.beginPath();
                ctx.moveTo(startX, startY);
                ctx.lineTo(adjustedX, adjustedY);
                ctx.stroke();
            } else if (currentShape.type === 'triangle') {
                ctx.beginPath();
                ctx.moveTo(startX, startY);
                ctx.lineTo(adjustedX, adjustedY);
                ctx.lineTo(startX - (adjustedX - startX), adjustedY);
                ctx.closePath();
                ctx.stroke();
            }
            if (shapeTimer) clearTimeout(shapeTimer);
            setShapeTimer(setTimeout(() => {
                const shapeType = detectShape(scratchPoints);
                if (shapeType) {
                    setCurrentShape(prev => ({ ...prev, type: shapeType }));
                    ctx.strokeStyle = color;
                    ctx.lineWidth = lineWidth;
                    const endX = scratchPoints[scratchPoints.length - 1]?.x || adjustedX;
                    const endY = scratchPoints[scratchPoints.length - 1]?.y || adjustedY;
                    if (shapeType === 'rectangle') {
                        ctx.strokeRect(startX, startY, endX - startX, endY - startY);
                    } else if (shapeType === 'circle') {
                        const radius = Math.sqrt(Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2));
                        ctx.beginPath();
                        ctx.arc(startX, startY, radius, 0, Math.PI * 2);
                        ctx.stroke();
                    } else if (shapeType === 'line') {
                        ctx.beginPath();
                        ctx.moveTo(startX, startY);
                        ctx.lineTo(endX, endY);
                        ctx.stroke();
                    } else if (shapeType === 'triangle') {
                        ctx.beginPath();
                        ctx.moveTo(startX, startY);
                        ctx.lineTo(endX, endY);
                        ctx.lineTo(startX - (endX - startX), endY);
                        ctx.closePath();
                        ctx.stroke();
                    }
                    saveCanvasState();
                }
            }, 500));
        } else if (isScratching) {
            setScratchPoints(prev => [...prev, { x: adjustedX, y: adjustedY }]);
            ctx.strokeStyle = 'rgba(255, 0, 0, 0.3)';
            ctx.lineWidth = lineWidth * 2;
            ctx.beginPath();
            ctx.moveTo(scratchPoints[scratchPoints.length - 1].x, scratchPoints[scratchPoints.length - 1].y);
            ctx.lineTo(adjustedX, adjustedY);
            ctx.stroke();
            setTimeout(() => {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.putImageData(history[historyIndex], 0, 0);
            }, 500);
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            for (let i = 0; i < scratchPoints.length; i++) {
                const point = scratchPoints[i];
                const x = Math.floor(point.x);
                const y = Math.floor(point.y);
                if (x >= 0 && x < canvas.width && y >= 0 && y < canvas.height) {
                    const index = (y * canvas.width + x) * 4;
                    if (imageData.data[index + 3] > 0) {
                        ctx.clearRect(x - lineWidth, y - lineWidth, lineWidth * 2, lineWidth * 2);
                    }
                }
            }
            latexExpression.forEach((latex, index) => {
                const latexElement = document.querySelector(`.latex-content:nth-child(${index + 1})`);
                if (latexElement) {
                    const rect = latexElement.getBoundingClientRect();
                    const canvasRect = canvas.getBoundingClientRect();
                    const latexX = (rect.left - canvasRect.left - canvasPosition.x) / zoomLevel;
                    const latexY = (rect.top - canvasRect.top - canvasPosition.y) / zoomLevel;
                    if (scratchPoints.some(p => p.x >= latexX && p.x <= latexX + rect.width / zoomLevel && p.y >= latexY && p.y <= latexY + rect.height / zoomLevel)) {
                        setLatexExpression(prev => prev.filter((_, i) => i !== index));
                    }
                }
            });
        } else if (isDrawing) {
            ctx.strokeStyle = isEraser ? 'black' : color;
            ctx.lineTo(adjustedX, adjustedY);
            ctx.stroke();
        }
    };

    const stopDrawing = () => {
        if (isDrawingShape) {
            const shapeType = detectShape(scratchPoints);
            if (shapeType) {
                setCurrentShape(prev => ({ ...prev, type: shapeType }));
                const canvas = canvasRef.current;
                if (canvas) {
                    const ctx = canvas.getContext('2d');
                    if (ctx) {
                        ctx.strokeStyle = color;
                        ctx.lineWidth = lineWidth;
                        const { startX, startY } = currentShape;
                        const endX = scratchPoints[scratchPoints.length - 1]?.x || startX;
                        const endY = scratchPoints[scratchPoints.length - 1]?.y || startY;
                        if (shapeType === 'rectangle') {
                            ctx.strokeRect(startX, startY, endX - startX, endY - startY);
                        } else if (shapeType === 'circle') {
                            const radius = Math.sqrt(Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2));
                            ctx.beginPath();
                            ctx.arc(startX, startY, radius, 0, Math.PI * 2);
                            ctx.stroke();
                        } else if (shapeType === 'line') {
                            ctx.beginPath();
                            ctx.moveTo(startX, startY);
                            ctx.lineTo(endX, endY);
                            ctx.stroke();
                        } else if (shapeType === 'triangle') {
                            ctx.beginPath();
                            ctx.moveTo(startX, startY);
                            ctx.lineTo(endX, endY);
                            ctx.lineTo(startX - (endX - startX), endY);
                            ctx.closePath();
                            ctx.stroke();
                        }
                    }
                }
            }
            setIsDrawingShape(false);
            setCurrentShape({ type: null, startX: 0, startY: 0 });
        }
        if (isScratching) {
            setIsScratching(false);
            setScratchPoints([]);
        }
        if (isDrawing) {
            setIsDrawing(false);
            saveCanvasState();
        }
        if (shapeTimer) {
            clearTimeout(shapeTimer);
            setShapeTimer(null);
        }
    };

    const detectShape = (points: { x: number; y: number }[]) => {
        if (points.length < 3) return null;
        const start = points[0];
        const end = points[points.length - 1];
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const angle = Math.atan2(dy, dx) * 180 / Math.PI;
        const isLine = points.every((point, i) => {
            if (i === 0) return true;
            const prevPoint = points[i - 1];
            const currentAngle = Math.atan2(point.y - prevPoint.y, point.x - prevPoint.x) * 180 / Math.PI;
            return Math.abs(currentAngle - angle) < 15;
        });
        if (isLine) return 'line';
        const isRectangle = points.length >= 4 &&
            Math.abs(dx) > 20 && Math.abs(dy) > 20 &&
            Math.abs(Math.abs(dx) - Math.abs(dy)) < Math.max(Math.abs(dx), Math.abs(dy)) * 0.2;
        if (isRectangle) return 'rectangle';
        const center = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
        const radius = Math.sqrt(Math.pow(dx / 2, 2) + Math.pow(dy / 2, 2));
        const isCircle = points.every((point, i) => {
            if (i === 0 || i === points.length - 1) return true;
            const distance = Math.sqrt(Math.pow(point.x - center.x, 2) + Math.pow(point.y - center.y, 2));
            return Math.abs(distance - radius) < radius * 0.2;
        });
        if (isCircle) return 'circle';
        const isTriangle = points.length >= 4 &&
            points.some((point, i) => {
                if (i < 2 || i >= points.length - 1) return false;
                const p1 = points[i - 1];
                const p2 = point;
                const p3 = points[i + 1];
                const angle = Math.abs((Math.atan2(p3.y - p2.y, p3.x - p2.x) - Math.atan2(p1.y - p2.y, p1.x - p2.x)) * 180 / Math.PI);
                return angle > 45 && angle < 135;
            });
        if (isTriangle) return 'triangle';
        return null;
    };

    const convertHandwritingToText = async () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        setIsLoading(true);
        try {
            // Create a temporary canvas to invert colors for OCR in dark mode
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = canvas.width;
            tempCanvas.height = canvas.height;
            const tempCtx = tempCanvas.getContext('2d');
            if (!tempCtx) throw new Error('Failed to get temporary canvas context');

            // If in dark mode, invert colors (dark background to white, white drawings to black)
            if (isDarkMode) {
                tempCtx.fillStyle = '#ffffff';
                tempCtx.fillRect(0, 0, canvas.width, canvas.height);
                tempCtx.globalCompositeOperation = 'difference';
                tempCtx.drawImage(canvas, 0, 0);
                tempCtx.globalCompositeOperation = 'source-over';
            } else {
                tempCtx.drawImage(canvas, 0, 0);
            }

            // Convert to PNG and process with Tesseract
            const { data: { text } } = await Tesseract.recognize(tempCanvas.toDataURL('image/png'), 'eng', {
                logger: (m) => console.log(m),
            });
            setConvertedText(text);

            try {
                const response = await axios.post(`${import.meta.env.VITE_API_URL}/convert-text`, { text });
                setLatexExpression((prev) => [...prev, response.data.latex]);
            } catch (error) {
                console.warn('Backend text-to-LaTeX conversion failed, using raw text:', error);
                setLatexExpression((prev) => [...prev, `\\(${text.replace(/\$/g, '')}\\)`]);
            }
        } catch (error) {
            console.error('Handwriting conversion failed:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const runRoute = async () => {
        if (isLoading) return;
        setIsLoading(true);
        const canvas = canvasRef.current;
        if (canvas) {
            try {
                const response = await axios({
                    method: 'post',
                    url: `${import.meta.env.VITE_API_URL}`,
                    data: {
                        image: canvas.toDataURL('image/png'),
                        dict_of_vars: dictOfVars
                    }
                });
                const resp = await response.data;
                const newCalculations: GeneratedResult[] = [];
                let delay = 0;
                resp.data.forEach((data: Response) => {
                    if (data.assign === true) {
                        setDictOfVars((prev) => ({ ...prev, [data.expr]: data.result }));
                    }
                    newCalculations.push({ expression: data.expr, answer: data.result });
                    setTimeout(() => {
                        renderLatexToCanvas(data.expr, data.result);
                    }, delay);
                    delay += 1000;
                });
                setCalculationHistory((prev) => [...prev, ...newCalculations]);
                const ctx = canvas.getContext('2d');
                const imageData = ctx!.getImageData(0, 0, canvas.width, canvas.height);
                let minX = canvas.width, minY = canvas.height, maxX = 0, maxY = 0;
                let hasDrawnContent = false;
                for (let y = 0; y < canvas.height; y++) {
                    for (let x = 0; x < canvas.width; x++) {
                        const i = (y * canvas.width + x) * 4;
                        if (imageData.data[i + 3] > 0) {
                            minX = Math.min(minX, x);
                            minY = Math.min(minY, y);
                            maxX = Math.max(maxX, x);
                            maxY = Math.max(maxY, y);
                            hasDrawnContent = true;
                        }
                    }
                }
                const centerX = (hasDrawnContent ? (minX + maxX) / 2 : canvas.width / 2) + canvasPosition.x;
                const centerY = (hasDrawnContent ? (minY + maxY) / 2 : canvas.height / 2) + canvasPosition.y;
                setLatexPosition({ x: centerX, y: centerY });
            } catch (error) {
                console.error('Failed to process calculation:', error);
            } finally {
                setIsLoading(false);
            }
        }
    };

    const handleHistoryClick = (calc: GeneratedResult) => {
        renderLatexToCanvas(calc.expression, calc.answer);
    };

    const clearHistory = () => {
        setCalculationHistory([]);
    };

    const updateZoom = (delta: number) => {
        setZoomLevel(prev => Math.max(0.5, Math.min(3, prev + delta)));
    };

    // Check if LaTeX dragging requires canvas expansion
    const handleLatexDrag = useCallback((e: DraggableEvent, data: { x: number; y: number }) => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const adjustedX = (data.x * zoomLevel - canvasPosition.x) / zoomLevel;
        const adjustedY = (data.y * zoomLevel - canvasPosition.y) / zoomLevel;

        // Expand canvas if LaTeX is dragged near edges
        expandCanvas(adjustedX, adjustedY);

        setLatexPosition({ x: data.x * zoomLevel, y: data.y * zoomLevel });
    }, [expandCanvas, canvasPosition, zoomLevel]);

    return (
        <>
            <div
                className={`fixed top-0 left-0 h-full bg-card text-card-foreground shadow-lg z-30 transition-all duration-300 ease-in-out ${
                    isSidebarOpen ? 'opacity-100 w-32' : 'opacity-0 w-0'
                }`}
            >
                <div className="grid grid-cols-2 gap-2 p-4">
                    <div className="flex flex-col items-center space-y-2">
                        <Button
                            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                            className="bg-blue-600 text-white hover:bg-blue-700 rounded-md border border-blue-700"
                            variant="default"
                            size="icon"
                            title="Toggle Sidebar"
                            aria-label="Toggle Sidebar"
                        >
                            {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
                        </Button>
                        <Button
                            onClick={() => setReset(true)}
                            className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md border border-primary/50"
                            variant="default"
                            size="icon"
                            title="Reset"
                            aria-label="Reset Canvas"
                        >
                            <RotateCcw size={20} />
                        </Button>
                        <Button
                            onClick={undo}
                            className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md border border-primary/50"
                            variant="default"
                            size="icon"
                            disabled={historyIndex <= 0}
                            title="Undo"
                            aria-label="Undo"
                        >
                            <RotateCw size={20} />
                        </Button>
                        <Button
                            onClick={redo}
                            className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md border border-primary/50"
                            variant="default"
                            size="icon"
                            disabled={historyIndex >= history.length - 1}
                            title="Redo"
                            aria-label="Redo"
                        >
                            <RotateCw size={20} />
                        </Button>
                        <Button
                            onClick={() => setIsHistoryOpen(!isHistoryOpen)}
                            className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md border border-primary/50"
                            variant="default"
                            size="icon"
                            title={isHistoryOpen ? 'Hide History' : 'Show History'}
                            aria-label={isHistoryOpen ? 'Hide History' : 'Show History'}
                        >
                            <History size={20} />
                        </Button>
                        <Button
                            onClick={runRoute}
                            className="bg-green-600 text-white hover:bg-green-700 rounded-md border border-green-700"
                            variant="default"
                            size="icon"
                            title="Run"
                            aria-label="Run Calculation"
                            disabled={isLoading}
                        >
                            {isLoading ? <Loader2 size={20} className="animate-spin" /> : <Play size={20} />}
                        </Button>
                        <Button
                            onClick={convertHandwritingToText}
                            className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md border border-primary/50"
                            variant="default"
                            size="icon"
                            title="Convert to Text"
                            aria-label="Convert Handwriting to Text"
                            disabled={isLoading}
                        >
                            {isLoading ? <Loader2 size={20} className="animate-spin" /> : <Text size={20} />}
                        </Button>
                    </div>
                    <div className="flex flex-col items-center space-y-2">
                        <Button
                            onClick={() => setShowColorPalette(!showColorPalette)}
                            className={`${showColorPalette ? 'bg-blue-600' : 'bg-primary'} text-primary-foreground hover:bg-primary/90 rounded-md border border-primary/50`}
                            variant="default"
                            size="icon"
                            title="Select Color"
                            aria-label="Select Color"
                        >
                            <Palette size={20} />
                        </Button>
                        <div
                            className={`transition-all duration-300 ease-in-out overflow-hidden ${
                                showColorPalette ? 'max-h-48 opacity-100' : 'max-h-0 opacity-0'
                            }`}
                        >
                            <Group className="flex flex-col space-y-1 bg-card p-2 rounded-md shadow-md border border-border dark:bg-gray-800 dark:border-gray-700">
                                {SWATCHES.map((swatch) => (
                                    <ColorSwatch
                                        key={swatch}
                                        color={swatch}
                                        onClick={() => {
                                            setColor(swatch);
                                            setShowColorPalette(false);
                                        }}
                                        className={`cursor-pointer hover:scale-110 transition-transform ${
                                            color === swatch ? 'ring-2 ring-blue-500' : ''
                                        }`}
                                        size={16}
                                    />
                                ))}
                            </Group>
                        </div>
                        <Button
                            onClick={() => setShowBackgrounds(!showBackgrounds)}
                            className={`${showBackgrounds ? 'bg-blue-600' : 'bg-primary'} text-primary-foreground hover:bg-primary/90 rounded-md border border-primary/50`}
                            variant="default"
                            size="icon"
                            title="Select Background"
                            aria-label="Select Background"
                        >
                            <Layout size={20} />
                        </Button>
                        <div
                            className={`transition-all duration-300 ease-in-out overflow-hidden ${
                                showBackgrounds ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
                            }`}
                        >
                            <div className="bg-card p-3 rounded-md shadow-md border border-border dark:bg-gray-800 dark:border-gray-700">
                                {backgrounds.map(bg => (
                                    <Button
                                        key={bg.label}
                                        onClick={() => {
                                            setBackgroundStyle(bg);
                                            setShowBackgrounds(false);
                                        }}
                                        className={`w-full flex items-center justify-between text-left py-2 px-3 rounded-md hover:bg-accent dark:hover:bg-gray-700 transition-colors ${
                                            backgroundStyle.label === bg.label ? 'bg-blue-100 dark:bg-blue-900 font-semibold' : ''
                                        }`}
                                        variant="ghost"
                                    >
                                        <div className="flex items-center space-x-2">
                                            {bg.type === 'color' ? (
                                                <div
                                                    className="w-5 h-5 rounded-full border border-gray-300 dark:border-gray-600"
                                                    style={{ backgroundColor: isDarkMode ? '#1a1a1a' : bg.value }}
                                                />
                                            ) : (
                                                <div
                                                    className="w-5 h-5 rounded-sm border border-gray-300 dark:border-gray-600"
                                                    style={{
                                                        backgroundImage: bg.value === 'grid' ? 'url(#gridPattern)' : 'url(#dotPattern)',
                                                        backgroundColor: isDarkMode ? '#1a1a1a' : '#ffffff',
                                                    }}
                                                />
                                            )}
                                            <span>{bg.label}</span>
                                        </div>
                                        {backgroundStyle.label === bg.label && <Check size={16} className="text-blue-500" />}
                                    </Button>
                                ))}
                            </div>
                        </div>
                        <Button
                            onClick={() => setLineWidth(Math.max(1, lineWidth - 1))}
                            className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md border border-primary/50"
                            variant="default"
                            size="icon"
                            title="Decrease Line Width"
                            aria-label="Decrease Line Width"
                        >
                            <Minus size={16} />
                        </Button>
                        <div className="text-xs text-center">{lineWidth}px</div>
                        <Button
                            onClick={() => setLineWidth(Math.min(20, lineWidth + 1))}
                            className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md border border-primary/50"
                            variant="default"
                            size="icon"
                            title="Increase Line Width"
                            aria-label="Increase Line Width"
                        >
                            <Plus size={16} />
                        </Button>
                        <Button
                            onClick={() => setIsEraser(!isEraser)}
                            className={`${isEraser ? 'bg-blue-600' : 'bg-primary'} text-primary-foreground hover:bg-primary/90 rounded-md border border-primary/50`}
                            variant="default"
                            size="icon"
                            title={isEraser ? 'Disable Eraser' : 'Enable Eraser'}
                            aria-label={isEraser ? 'Disable Eraser' : 'Enable Eraser'}
                        >
                            <Eraser size={16} />
                        </Button>
                        <Button
                            onClick={() => updateZoom(0.1)}
                            className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md border border-primary/50"
                            variant="default"
                            size="icon"
                            title="Zoom In"
                            aria-label="Zoom In"
                        >
                            <Plus size={16} />
                        </Button>
                        <Button
                            onClick={() => updateZoom(-0.1)}
                            className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md border border-primary/50"
                            variant="default"
                            size="icon"
                            title="Zoom Out"
                            aria-label="Zoom Out"
                        >
                            <Minus size={16} />
                        </Button>
                        <Button
                            onClick={() => {
                                setIsDarkMode(!isDarkMode);
                                document.documentElement.classList.toggle('dark');
                            }}
                            className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md border border-primary/50"
                            variant="default"
                            size="icon"
                            title={isDarkMode ? 'Light Mode' : 'Dark Mode'}
                            aria-label={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                        >
                            {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
                        </Button>
                    </div>
                </div>
            </div>

            {!isSidebarOpen && (
                <div
                    className="fixed top-4 left-4 z-40 transition-opacity duration-300"
                    onMouseEnter={() => setIsHovering(true)}
                    onMouseLeave={() => setIsHovering(false)}
                >
                    <Button
                        onClick={() => setIsSidebarOpen(true)}
                        className={`bg-blue-600 text-white hover:bg-blue-700 rounded-md border border-blue-700 transition-all duration-300 ${
                            isHovering ? 'scale-110 shadow-lg' : 'scale-100'
                        }`}
                        variant="default"
                        size="icon"
                        title="Show Sidebar"
                        aria-label="Show Sidebar"
                    >
                        <Menu size={20} />
                    </Button>
                </div>
            )}

            <canvas
                ref={canvasRef}
                id="canvas"
                className={`absolute top-0 left-0 z-10 ${isSidebarOpen ? 'pl-32' : ''}`}
                style={{
                    transform: `translate(${canvasPosition.x}px, ${canvasPosition.y}px) scale(${zoomLevel})`,
                    transformOrigin: '0 0',
                    background: backgroundStyle.type === 'color' ? (isDarkMode ? '#1a1a1a' : backgroundStyle.value) : 'transparent'
                }}
                onMouseDown={(e) => {
                    startDragging(e);
                    startDrawing(e);
                }}
                onMouseMove={(e) => {
                    dragCanvas(e);
                    draw(e);
                }}
                onMouseUp={() => {
                    stopDragging();
                    stopDrawing();
                }}
                onMouseOut={() => {
                    stopDragging();
                    stopDrawing();
                }}
            />

            {isHistoryOpen && (
                <div
                    className="fixed top-0 right-0 w-80 h-full bg-card text-card-foreground p-4 shadow-lg z-30 overflow-y-auto transition-transform duration-300 ease-in-out"
                    style={{ transform: isHistoryOpen ? 'translateX(0)' : 'translateX(100%)' }}
                >
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-lg font-semibold">Calculation History</h2>
                        <Button
                            onClick={clearHistory}
                            className="bg-destructive text-destructive-foreground rounded-md"
                            variant="default"
                            size="sm"
                            disabled={calculationHistory.length === 0}
                            aria-label="Clear History"
                        >
                            Clear History
                        </Button>
                    </div>
                    {calculationHistory.length === 0 ? (
                        <p className="text-muted-foreground">No calculations yet.</p>
                    ) : (
                        <ul className="space-y-2">
                            {calculationHistory.map((calc, index) => (
                                <li
                                    key={index}
                                    className="p-3 bg-muted rounded-md border border-border shadow-sm cursor-pointer hover:bg-accent transition-colors"
                                    onClick={() => handleHistoryClick(calc)}
                                >
                                    <div className="font-medium">{calc.expression}</div>
                                    <div className="text-sm text-muted-foreground">= {calc.answer}</div>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}

            {convertedText && (
                <div className="fixed bottom-4 left-4 bg-card p-4 rounded-md shadow-md z-20">
                    <label htmlFor="converted-text" className="text-sm font-medium text-card-foreground">
                        Recognized Text
                    </label>
                    <textarea
                        id="converted-text"
                        value={convertedText}
                        onChange={(e) => setConvertedText(e.target.value)}
                        className="w-64 h-32 p-2 mt-1 border border-input rounded-md dark:bg-gray-800 dark:text-white"
                        placeholder="Write or draw on the canvas to convert to text"
                        aria-label="Recognized Text"
                    />
                    <Button
                        onClick={() => setConvertedText('')}
                        className="mt-2"
                        variant="destructive"
                        size="sm"
                        aria-label="Clear Recognized Text"
                    >
                        Clear
                    </Button>
                </div>
            )}

            {latexExpression &&
                latexExpression.map((latex, index) => (
                    <Draggable
                        key={index}
                        defaultPosition={{ x: latexPosition.x / zoomLevel, y: latexPosition.y / zoomLevel }}
                        onDrag={handleLatexDrag}
                    >
                        <div className="absolute p-2 bg-card text-card-foreground rounded-md shadow-md z-20 dark:bg-gray-800 dark:text-white">
                            <div className="latex-content">{latex}</div>
                        </div>
                    </Draggable>
                ))}
        </>
    );
}
