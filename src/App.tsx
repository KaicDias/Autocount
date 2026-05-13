import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { 
  Camera, 
  Upload, 
  Package, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  RefreshCcw,
  LayoutGrid,
  Search,
  Layers,
  BarChart3,
  Video,
  FileVideo,
  FileDown,
  FileText,
  FileSpreadsheet,
  History,
  Trash2,
  TrendingUp,
  PieChart as PieChartIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { analyzeInventoryMedia, DetectionResult } from './services/geminiService';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  LineChart, 
  Line,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface HistoryItem extends DetectionResult {
  id: string;
  timestamp: string;
  mediaType: string;
}

const COLORS = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export default function App() {
  const [media, setMedia] = useState<{ url: string; type: string } | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [result, setResult] = useState<DetectionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<'idle' | 'processing' | 'result'>('idle');
  const [history, setHistory] = useState<HistoryItem[]>(() => {
    const saved = localStorage.getItem('autocount_history');
    return saved ? JSON.parse(saved) : [];
  });
  const [view, setView] = useState<'analysis' | 'dashboard'>('analysis');

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setMedia({ url: reader.result as string, type: file.type });
        setStep('idle');
        setResult(null);
        setError(null);
      };
      reader.readAsDataURL(file);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/webp': ['.webp'],
      'video/mp4': ['.mp4'],
      'video/webm': ['.webm'],
      'video/quicktime': ['.mov']
    },
    multiple: false
  } as any);

  const handleAnalyze = async () => {
    if (!media) return;
    
    setIsAnalyzing(true);
    setStep('processing');
    setError(null);

    try {
      const data = await analyzeInventoryMedia(media.url, media.type);
      setResult(data);
      setStep('result');

      // Add to history
      const newItem: HistoryItem = {
        ...data,
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        mediaType: media.type
      };
      const updatedHistory = [newItem, ...history];
      setHistory(updatedHistory);
      localStorage.setItem('autocount_history', JSON.stringify(updatedHistory));
    } catch (err) {
      console.error(err);
      setError('Falha ao analisar o arquivo. Por favor, tente novamente.');
      setStep('idle');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleExportPDF = async () => {
    if (!result || !media) return;
    setIsExporting(true);

    try {
      const doc = new jsPDF();
      const timestamp = new Date().toLocaleString('pt-BR');
      
      // Header
      doc.setFillColor(37, 99, 235); // Blue-600
      doc.rect(0, 0, 210, 40, 'F');
      
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(24);
      doc.setFont('helvetica', 'bold');
      doc.text('AutoCount - Relatório de Estoque', 15, 25);
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Gerado em: ${timestamp}`, 15, 33);

      // Summary Section
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('Resumo da Análise', 15, 55);
      
      doc.setFontSize(12);
      doc.setFont('helvetica', 'normal');
      doc.text(`Total de Itens Detectados: ${result.count}`, 15, 65);
      doc.text(`Tipo de Mídia: ${media.type.startsWith('video/') ? 'Vídeo' : 'Imagem'}`, 15, 72);

      // Summary Text
      doc.setFontSize(11);
      const splitSummary = doc.splitTextToSize(`Descrição: ${result.summary}`, 180);
      doc.text(splitSummary, 15, 82);

      // Items Table
      const tableData = result.items.map((item, index) => [index + 1, item]);
      (doc as any).autoTable({
        startY: 100,
        head: [['#', 'Item Identificado']],
        body: tableData,
        theme: 'striped',
        headStyles: { fillStyle: [37, 99, 235] },
        styles: { font: 'helvetica', fontSize: 10 }
      });

      // Footer
      const pageCount = (doc as any).internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text('AutoCount Industrial Systems - Relatório Gerado Automaticamente via IA', 105, 285, { align: 'center' });
      }

      doc.save(`relatorio-estoque-${new Date().getTime()}.pdf`);
    } catch (err) {
      console.error('Erro ao exportar PDF:', err);
      setError('Erro ao gerar o relatório PDF.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportExcel = () => {
    if (history.length === 0) return;
    setIsExporting(true);

    try {
      const timestamp = new Date().toLocaleString('pt-BR');
      
      // Prepare Summary Data
      const summaryData = history.map(item => ({
        "ID": item.id.slice(0, 8),
        "Data/Hora": new Date(item.timestamp).toLocaleString('pt-BR'),
        "Tipo": item.mediaType.startsWith('video/') ? 'Vídeo' : 'Imagem',
        "Total de Itens": item.count,
        "Resumo": item.summary
      }));

      // Prepare Detailed Items Data
      const itemsData = history.flatMap(item => 
        item.items.map(desc => ({
          "Análise ID": item.id.slice(0, 8),
          "Data": new Date(item.timestamp).toLocaleDateString('pt-BR'),
          "Item": desc
        }))
      );

      // Create Workbook and Sheets
      const wb = XLSX.utils.book_new();
      const wsSummary = XLSX.utils.json_to_sheet(summaryData);
      const wsItems = XLSX.utils.json_to_sheet(itemsData);

      // Add Sheets to Workbook
      XLSX.utils.book_append_sheet(wb, wsSummary, "Histórico de Análises");
      XLSX.utils.book_append_sheet(wb, wsItems, "Detalhes por Item");

      // Save File
      XLSX.writeFile(wb, `relatorio-estoque-completo-${new Date().getTime()}.xlsx`);
    } catch (err) {
      console.error('Erro ao exportar Excel:', err);
      setError('Erro ao gerar o relatório Excel.');
    } finally {
      setIsExporting(false);
    }
  };

  const clearHistory = () => {
    if (window.confirm('Deseja realmente limpar todo o histórico?')) {
      setHistory([]);
      localStorage.removeItem('autocount_history');
    }
  };

  const deleteHistoryItem = (id: string) => {
    const updated = history.filter(item => item.id !== id);
    setHistory(updated);
    localStorage.setItem('autocount_history', JSON.stringify(updated));
  };

  const reset = () => {
    setMedia(null);
    setResult(null);
    setStep('idle');
    setError(null);
  };

  const isVideo = media?.type.startsWith('video/');

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-zinc-200 px-6 py-4 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-lg">
              <Package className="text-white w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-zinc-900">AutoCount</h1>
              <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider">Controle de Estoque Inteligente</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <nav className="flex items-center bg-zinc-100 p-1 rounded-lg">
              <button
                onClick={() => setView('analysis')}
                className={cn(
                  "px-4 py-1.5 text-sm font-medium rounded-md transition-all",
                  view === 'analysis' ? "bg-white text-blue-600 shadow-sm" : "text-zinc-500 hover:text-zinc-700"
                )}
              >
                Análise
              </button>
              <button
                onClick={() => setView('dashboard')}
                className={cn(
                  "px-4 py-1.5 text-sm font-medium rounded-md transition-all",
                  view === 'dashboard' ? "bg-white text-blue-600 shadow-sm" : "text-zinc-500 hover:text-zinc-700"
                )}
              >
                Dashboard
              </button>
            </nav>
            <div className="h-4 w-px bg-zinc-200" />
            <div className="flex items-center gap-4 text-zinc-400">
              <BarChart3 className="w-5 h-5" />
              <div className="h-4 w-px bg-zinc-200" />
              <span className="text-sm font-mono">v1.4.0</span>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full p-6">
        <AnimatePresence mode="wait">
          {view === 'analysis' ? (
            <motion.div 
              key="analysis"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="grid grid-cols-1 lg:grid-cols-12 gap-8"
            >
              {/* Left Column: Upload & Preview */}
              <div className="lg:col-span-7 space-y-6">
                <section className="glass-panel p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                      {isVideo ? <Video className="w-5 h-5 text-blue-600" /> : <Camera className="w-5 h-5 text-blue-600" />}
                      Captura de {isVideo ? 'Vídeo' : 'Imagem'}
                    </h2>
                    {media && (
                      <button 
                        onClick={reset}
                        className="text-sm text-zinc-500 hover:text-red-600 flex items-center gap-1 transition-colors"
                      >
                        <RefreshCcw className="w-4 h-4" />
                        Limpar
                      </button>
                    )}
                  </div>

                  {!media ? (
                    <div 
                      {...getRootProps()} 
                      className={cn(
                        "border-2 border-dashed rounded-xl p-12 transition-all cursor-pointer flex flex-col items-center justify-center gap-4",
                        isDragActive ? "border-blue-500 bg-blue-50" : "border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50"
                      )}
                    >
                      <input {...getInputProps()} />
                      <div className="bg-zinc-100 p-4 rounded-full flex gap-2">
                        <Upload className="w-8 h-8 text-zinc-400" />
                        <FileVideo className="w-8 h-8 text-zinc-400" />
                      </div>
                      <div className="text-center">
                        <p className="text-zinc-900 font-medium">Arraste uma foto ou vídeo do rack</p>
                        <p className="text-zinc-500 text-sm mt-1">Imagens ou Vídeos (MP4, WEBM, MOV)</p>
                      </div>
                    </div>
                  ) : (
                    <div className="relative rounded-xl overflow-hidden border border-zinc-200 bg-black aspect-video flex items-center justify-center">
                      {isVideo ? (
                        <video 
                          src={media.url} 
                          controls 
                          className={cn(
                            "max-w-full max-h-full transition-opacity",
                            isAnalyzing ? "opacity-50" : "opacity-100"
                          )}
                        />
                      ) : (
                        <img 
                          src={media.url} 
                          alt="Preview" 
                          className={cn(
                            "max-w-full max-h-full object-contain transition-opacity",
                            isAnalyzing ? "opacity-50" : "opacity-100"
                          )}
                          referrerPolicy="no-referrer"
                        />
                      )}
                      
                      {isAnalyzing && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/20 backdrop-blur-[2px] z-20">
                          <div className="relative">
                            <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
                            <div className="absolute inset-0 animate-ping bg-blue-500/20 rounded-full" />
                          </div>
                          <div className="text-white text-center">
                            <p className="font-bold text-lg">Analisando {isVideo ? 'Vídeo' : 'Imagem'}...</p>
                            <p className="text-sm opacity-80">Detectando e contando itens via IA</p>
                          </div>
                        </div>
                      )}

                      <AnimatePresence>
                        {step === 'result' && (
                          <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="absolute inset-0 pointer-events-none z-10"
                          >
                            <div className="absolute inset-0 border-4 border-emerald-500/30 animate-pulse" />
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}

                  {media && step === 'idle' && (
                    <button
                      onClick={handleAnalyze}
                      disabled={isAnalyzing}
                      className="w-full mt-6 bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-600/20 disabled:opacity-50"
                    >
                      <Search className="w-5 h-5" />
                      Iniciar Contagem Automática
                    </button>
                  )}
                </section>

                {/* Process Flow */}
                <section className="glass-panel p-6">
                  <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-widest mb-6">Fluxo de Processamento</h3>
                  <div className="grid grid-cols-4 gap-4">
                    {[
                      { icon: isVideo ? Video : Camera, label: 'Captura', active: !!media },
                      { icon: Layers, label: 'Pré-proc.', active: isAnalyzing || step === 'result' },
                      { icon: LayoutGrid, label: 'Segmentação', active: isAnalyzing || step === 'result' },
                      { icon: CheckCircle2, label: 'Contagem', active: step === 'result' },
                    ].map((item, i) => (
                      <div key={i} className="flex flex-col items-center gap-2">
                        <div className={cn(
                          "w-12 h-12 rounded-full flex items-center justify-center border-2 transition-all",
                          item.active ? "bg-blue-50 border-blue-500 text-blue-600" : "bg-zinc-50 border-zinc-200 text-zinc-300"
                        )}>
                          <item.icon className="w-6 h-6" />
                        </div>
                        <span className={cn(
                          "text-[10px] font-bold uppercase tracking-tighter",
                          item.active ? "text-blue-600" : "text-zinc-400"
                        )}>{item.label}</span>
                      </div>
                    ))}
                  </div>
                </section>
              </div>

              {/* Right Column: Results & Stats */}
              <div className="lg:col-span-5 space-y-6">
                <section className="glass-panel p-6 h-full flex flex-col">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                      <BarChart3 className="w-5 h-5 text-blue-600" />
                      Resultados da Análise
                    </h2>
                    {step === 'result' && result && (
                      <div className="flex gap-2">
                        <button
                          onClick={handleExportPDF}
                          disabled={isExporting}
                          title="Exportar PDF"
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50"
                        >
                          <FileDown className="w-4 h-4" />
                        </button>
                        <button
                          onClick={handleExportExcel}
                          disabled={isExporting}
                          title="Exportar Excel"
                          className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors disabled:opacity-50"
                        >
                          <FileSpreadsheet className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>

                  <AnimatePresence mode="wait">
                    {step === 'idle' && (
                      <motion.div 
                        key="idle"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="flex-1 flex flex-col items-center justify-center text-center p-8 border-2 border-dashed border-zinc-100 rounded-xl"
                      >
                        <Package className="w-12 h-12 text-zinc-200 mb-4" />
                        <p className="text-zinc-500">Aguardando arquivo para iniciar o processamento de estoque.</p>
                      </motion.div>
                    )}

                    {step === 'processing' && (
                      <motion.div 
                        key="processing"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex-1 space-y-6"
                      >
                        <div className="space-y-4">
                          {[1, 2, 3].map((i) => (
                            <div key={i} className="h-12 bg-zinc-100 rounded-lg animate-pulse" />
                          ))}
                        </div>
                        <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
                          <p className="text-sm text-blue-700 font-medium flex items-center gap-2">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            {isVideo ? 'Analisando quadros do vídeo...' : 'Extraindo metadados visuais...'}
                          </p>
                        </div>
                      </motion.div>
                    )}

                    {step === 'result' && result && (
                      <motion.div 
                        key="result"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="flex-1 space-y-6"
                      >
                        {/* Main Count Card */}
                        <div className="bg-blue-600 rounded-2xl p-8 text-white shadow-xl shadow-blue-600/20 relative overflow-hidden">
                          <div className="relative z-10">
                            <p className="text-blue-100 text-sm font-bold uppercase tracking-widest mb-1">Total Detectado</p>
                            <div className="flex items-baseline gap-2">
                              <span className="text-6xl font-black tracking-tighter">{result.count}</span>
                              <span className="text-xl font-medium opacity-80">itens</span>
                            </div>
                          </div>
                          <Package className="absolute -right-4 -bottom-4 w-32 h-32 text-white/10 rotate-12" />
                        </div>

                        {/* Summary */}
                        <div className="space-y-4">
                          <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl">
                            <h4 className="text-xs font-bold text-emerald-700 uppercase tracking-wider mb-1 flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" />
                              Status da Detecção
                            </h4>
                            <p className="text-sm text-emerald-900 leading-relaxed">
                              {result.summary}
                            </p>
                          </div>

                          <div className="space-y-2">
                            <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Itens Identificados</h4>
                            <div className="flex flex-wrap gap-2">
                              {result.items.map((item, i) => (
                                <span key={i} className="px-3 py-1 bg-zinc-100 text-zinc-700 rounded-full text-xs font-medium border border-zinc-200">
                                  {item}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>

                        <div className="mt-auto pt-6 border-t border-zinc-100 grid grid-cols-1 gap-3">
                          <div className="grid grid-cols-2 gap-3">
                            <button 
                              onClick={handleExportPDF}
                              disabled={isExporting}
                              className="py-3 text-sm font-bold text-blue-600 hover:bg-blue-50 rounded-xl border border-blue-100 transition-all flex items-center justify-center gap-2"
                            >
                              <FileText className="w-4 h-4" />
                              PDF
                            </button>
                            <button 
                              onClick={handleExportExcel}
                              disabled={isExporting}
                              className="py-3 text-sm font-bold text-emerald-600 hover:bg-emerald-50 rounded-xl border border-emerald-100 transition-all flex items-center justify-center gap-2"
                            >
                              <FileSpreadsheet className="w-4 h-4" />
                              Excel
                            </button>
                          </div>
                          <button 
                            onClick={reset}
                            className="py-3 text-sm font-bold text-zinc-500 hover:text-blue-600 transition-colors flex items-center justify-center gap-2"
                          >
                            <RefreshCcw className="w-4 h-4" />
                            Nova Análise
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {error && (
                    <div className="mt-4 p-4 bg-red-50 border border-red-100 rounded-xl flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                      <p className="text-sm text-red-800 font-medium">{error}</p>
                    </div>
                  )}
                </section>
              </div>
            </motion.div>
          ) : (
            <motion.div 
              key="dashboard"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              {/* Dashboard Stats */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="glass-panel p-6">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-blue-100 rounded-lg text-blue-600">
                      <History className="w-5 h-5" />
                    </div>
                    <span className="text-sm font-medium text-zinc-500">Total Análises</span>
                  </div>
                  <p className="text-3xl font-bold text-zinc-900">{history.length}</p>
                </div>
                <div className="glass-panel p-6">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-emerald-100 rounded-lg text-emerald-600">
                      <Package className="w-5 h-5" />
                    </div>
                    <span className="text-sm font-medium text-zinc-500">Média de Itens</span>
                  </div>
                  <p className="text-3xl font-bold text-zinc-900">
                    {history.length > 0 
                      ? (history.reduce((acc, curr) => acc + curr.count, 0) / history.length).toFixed(1) 
                      : 0}
                  </p>
                </div>
                <div className="glass-panel p-6">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-amber-100 rounded-lg text-amber-600">
                      <TrendingUp className="w-5 h-5" />
                    </div>
                    <span className="text-sm font-medium text-zinc-500">Maior Contagem</span>
                  </div>
                  <p className="text-3xl font-bold text-zinc-900">
                    {history.length > 0 ? Math.max(...history.map(h => h.count)) : 0}
                  </p>
                </div>
                <div className="glass-panel p-6">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-purple-100 rounded-lg text-purple-600">
                      <FileSpreadsheet className="w-5 h-5" />
                    </div>
                    <span className="text-sm font-medium text-zinc-500">Ações</span>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={handleExportExcel}
                      disabled={history.length === 0}
                      className="text-xs font-bold text-emerald-600 hover:underline disabled:opacity-50"
                    >
                      Exportar Tudo
                    </button>
                    <span className="text-zinc-300">|</span>
                    <button 
                      onClick={clearHistory}
                      disabled={history.length === 0}
                      className="text-xs font-bold text-red-600 hover:underline disabled:opacity-50"
                    >
                      Limpar Tudo
                    </button>
                  </div>
                </div>
              </div>

              {/* Charts Section */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <section className="glass-panel p-6">
                  <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-blue-600" />
                    Tendência de Estoque
                  </h3>
                  <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={[...history].reverse()}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                        <XAxis 
                          dataKey="timestamp" 
                          tickFormatter={(val) => new Date(val).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                          tick={{ fontSize: 10 }}
                          stroke="#a1a1aa"
                        />
                        <YAxis tick={{ fontSize: 10 }} stroke="#a1a1aa" />
                        <Tooltip 
                          labelFormatter={(val) => new Date(val).toLocaleString('pt-BR')}
                          contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="count" 
                          stroke="#2563eb" 
                          strokeWidth={3} 
                          dot={{ fill: '#2563eb', strokeWidth: 2, r: 4 }}
                          activeDot={{ r: 6, strokeWidth: 0 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </section>

                <section className="glass-panel p-6">
                  <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
                    <PieChartIcon className="w-5 h-5 text-blue-600" />
                    Distribuição de Itens
                  </h3>
                  <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={(() => {
                            const counts: Record<string, number> = {};
                            history.forEach(h => {
                              h.items.forEach(item => {
                                const key = item.split(' ')[0].toLowerCase(); // Basic grouping by first word
                                counts[key] = (counts[key] || 0) + 1;
                              });
                            });
                            return Object.entries(counts)
                              .map(([name, value]) => ({ name, value }))
                              .sort((a, b) => b.value - a.value)
                              .slice(0, 6);
                          })()}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {history.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend verticalAlign="bottom" height={36}/>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </section>
              </div>

              {/* History Table (Excel Style) */}
              <section className="glass-panel overflow-hidden">
                <div className="p-6 border-b border-zinc-100 flex items-center justify-between">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                    Histórico Detalhado (Excel View)
                  </h3>
                  <span className="text-xs text-zinc-400 font-mono">{history.length} registros encontrados</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-zinc-50 border-b border-zinc-100">
                        <th className="px-6 py-3 text-xs font-bold text-zinc-500 uppercase tracking-wider">ID</th>
                        <th className="px-6 py-3 text-xs font-bold text-zinc-500 uppercase tracking-wider">Data/Hora</th>
                        <th className="px-6 py-3 text-xs font-bold text-zinc-500 uppercase tracking-wider">Mídia</th>
                        <th className="px-6 py-3 text-xs font-bold text-zinc-500 uppercase tracking-wider">Contagem</th>
                        <th className="px-6 py-3 text-xs font-bold text-zinc-500 uppercase tracking-wider">Resumo</th>
                        <th className="px-6 py-3 text-xs font-bold text-zinc-500 uppercase tracking-wider text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {history.map((item) => (
                        <tr key={item.id} className="hover:bg-zinc-50 transition-colors group">
                          <td className="px-6 py-4 text-xs font-mono text-zinc-400">{item.id.slice(0, 8)}</td>
                          <td className="px-6 py-4 text-sm text-zinc-600">{new Date(item.timestamp).toLocaleString('pt-BR')}</td>
                          <td className="px-6 py-4">
                            <span className={cn(
                              "px-2 py-0.5 rounded text-[10px] font-bold uppercase",
                              item.mediaType.startsWith('video/') ? "bg-purple-50 text-purple-600" : "bg-blue-50 text-blue-600"
                            )}>
                              {item.mediaType.startsWith('video/') ? 'Vídeo' : 'Imagem'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm font-bold text-zinc-900">{item.count}</td>
                          <td className="px-6 py-4 text-sm text-zinc-500 truncate max-w-[200px]">{item.summary}</td>
                          <td className="px-6 py-4 text-right">
                            <button 
                              onClick={() => deleteHistoryItem(item.id)}
                              className="p-2 text-zinc-300 hover:text-red-600 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                      {history.length === 0 && (
                        <tr>
                          <td colSpan={6} className="px-6 py-12 text-center text-zinc-400 italic">
                            Nenhum registro no histórico. Analise uma imagem para começar.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-zinc-200 p-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-zinc-400 text-xs">
            © 2026 AutoCount Industrial Systems. Todos os direitos reservados.
          </p>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 text-zinc-500 text-xs font-medium">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Sistema Operacional
            </div>
            <div className="text-zinc-300 text-xs">|</div>
            <p className="text-zinc-400 text-xs italic">
              Desenvolvido por Kaic Dias - Eng. da Computação
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
