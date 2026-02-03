
import React, { useState, useCallback } from 'react';
import { 
  ClipboardCheck, 
  FileDown, 
  Play, 
  Table, 
  Trash2, 
  Upload, 
  AlertCircle,
  CheckCircle2,
  Loader2,
  Clock,
  Settings,
  ShieldCheck,
  Cpu
} from 'lucide-react';
import { ProductInput, ProductResult, ProcessingStatus, ApiProvider } from './types';
import { processProductsBatch as processWithGemini } from './services/geminiService';
import { processProductsWithDeepSeek } from './services/deepseekService';

const App: React.FC = () => {
  const [rawInput, setRawInput] = useState('');
  const [results, setResults] = useState<ProductResult[]>([]);
  const [isWaitingForNextBatch, setIsWaitingForNextBatch] = useState(false);
  const [provider, setProvider] = useState<ApiProvider>('gemini');
  const [deepSeekKey, setDeepSeekKey] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  
  const [status, setStatus] = useState<ProcessingStatus>({
    total: 0,
    completed: 0,
    isProcessing: false
  });

  const parseInput = (text: string): ProductInput[] => {
    return text.trim().split('\n').map(line => {
      const parts = line.split(/\t| {2,}/);
      return {
        sku: parts[0]?.trim() || '',
        chineseName: parts[1]?.trim() || ''
      };
    }).filter(p => p.sku && p.chineseName);
  };

  const handleProcess = async () => {
    const inputs = parseInput(rawInput);
    if (inputs.length === 0) {
      alert('请提供有效的数据内容（至少包含 SKU 和 产品名称）。');
      return;
    }

    if (provider === 'deepseek' && !deepSeekKey.trim()) {
      alert('请先在设置中输入 DeepSeek API Key。');
      setShowSettings(true);
      return;
    }

    setStatus({
      total: inputs.length,
      completed: 0,
      isProcessing: true,
      error: undefined
    });
    setResults([]);

    try {
      const batchSize = provider === 'gemini' ? 4 : 5; // DeepSeek handles slightly larger batches well
      
      for (let i = 0; i < inputs.length; i += batchSize) {
        const batch = inputs.slice(i, i + batchSize);
        
        if (i > 0) {
          setIsWaitingForNextBatch(true);
          await new Promise(resolve => setTimeout(resolve, 1500)); 
          setIsWaitingForNextBatch(false);
        }

        let batchResults: ProductResult[];
        if (provider === 'deepseek') {
          batchResults = await processProductsWithDeepSeek(batch, deepSeekKey);
        } else {
          batchResults = await processWithGemini(batch);
        }
        
        setResults(prev => [...prev, ...batchResults]);
        
        setStatus(prev => ({
          ...prev,
          completed: Math.min(prev.completed + batch.length, prev.total)
        }));
      }
    } catch (err: any) {
      setStatus(prev => ({ 
        ...prev, 
        error: `处理中断: ${err.message}。建议导出已完成的部分并检查网络/API Key。` 
      }));
    } finally {
      setStatus(prev => ({ ...prev, isProcessing: false }));
      setIsWaitingForNextBatch(false);
    }
  };

  const copyToExcel = useCallback(() => {
    if (results.length === 0) return;
    const header = ['SKU', '原版中文名', '俄语名称', '俄语简介', '俄语名称翻译'].join('\t');
    const rows = results.map(r => 
      [r.sku, r.chineseName, r.russianName, r.russianDescription, r.backTranslation].join('\t')
    ).join('\n');
    
    const fullText = `${header}\n${rows}`;
    navigator.clipboard.writeText(fullText).then(() => {
      alert('已成功复制到剪贴板，可直接粘贴至 Excel。');
    });
  }, [results]);

  const downloadCSV = useCallback(() => {
    if (results.length === 0) return;
    const header = ['SKU', 'Original CN', 'Russian Name', 'Russian Description', 'CN Translation'].join(',');
    const rows = results.map(r => 
      [
        `"${r.sku}"`, 
        `"${r.chineseName}"`, 
        `"${r.russianName.replace(/"/g, '""')}"`, 
        `"${r.russianDescription.replace(/"/g, '""')}"`, 
        `"${r.backTranslation.replace(/"/g, '""')}"`
      ].join(',')
    ).join('\n');
    
    const blob = new Blob([`\ufeff${header}\n${rows}`], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `ozon_export_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
  }, [results]);

  const clearAll = () => {
    if (window.confirm('确定要清空所有内容吗？')) {
      setRawInput('');
      setResults([]);
      setStatus({ total: 0, completed: 0, isProcessing: false });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-4">
            <div className="bg-blue-600 p-3 rounded-xl shadow-lg">
              <Table className="text-white w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Ozon 跨境电商助手</h1>
              <p className="text-sm text-gray-500 font-medium tracking-wide flex items-center gap-2">
                智能 AI 俄语 SEO 优化系统 
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                  {provider === 'gemini' ? 'Gemini 引擎' : 'DeepSeek 引擎'}
                </span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
             <button 
                onClick={() => setShowSettings(!showSettings)}
                className={`p-2 rounded-lg transition ${showSettings ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                title="设置"
             >
               <Settings size={20} />
             </button>
             {(results.length > 0 || rawInput.length > 0) && (
                <button 
                  onClick={clearAll}
                  className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition flex items-center gap-2 text-sm font-bold"
                >
                  <Trash2 size={16} /> 重置
                </button>
             )}
          </div>
        </header>

        {/* Settings Panel */}
        {showSettings && (
          <div className="bg-white p-6 rounded-2xl shadow-md border border-blue-100 animate-in slide-in-from-top-4 duration-300">
            <div className="flex items-center gap-2 mb-4 text-blue-700 font-bold">
              <ShieldCheck size={20} />
              <h3>API 与 模型配置</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700 flex items-center gap-2">
                  <Cpu size={14} /> 选择 AI 引擎
                </label>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setProvider('gemini')}
                    className={`flex-1 py-2 px-4 rounded-xl text-sm font-bold border-2 transition ${provider === 'gemini' ? 'bg-blue-50 border-blue-600 text-blue-700' : 'border-gray-100 text-gray-400'}`}
                  >
                    Gemini (默认)
                  </button>
                  <button 
                    onClick={() => setProvider('deepseek')}
                    className={`flex-1 py-2 px-4 rounded-xl text-sm font-bold border-2 transition ${provider === 'deepseek' ? 'bg-blue-50 border-blue-600 text-blue-700' : 'border-gray-100 text-gray-400'}`}
                  >
                    DeepSeek
                  </button>
                </div>
              </div>
              {provider === 'deepseek' && (
                <div className="space-y-2 animate-in fade-in duration-300">
                  <label className="text-sm font-bold text-gray-700">DeepSeek API Key</label>
                  <input 
                    type="password"
                    value={deepSeekKey}
                    onChange={(e) => setDeepSeekKey(e.target.value)}
                    placeholder="在此输入您的 sk-..."
                    className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
                  />
                  <p className="text-[10px] text-gray-400 italic">API Key 仅存储于浏览器内存中，刷新页面即清除</p>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Input */}
          <div className="lg:col-span-1 space-y-6">
            <section className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 h-full flex flex-col">
              <div className="flex items-center gap-2 mb-4">
                <Upload className="text-blue-600" size={20} />
                <h2 className="text-lg font-bold">粘贴数据</h2>
              </div>
              <p className="text-xs text-gray-500 mb-4 bg-blue-50 p-3 rounded-lg border border-blue-100">
                支持从 Excel 复制。左侧 SKU，右侧中文名。系统将自动批量处理。
              </p>
              <textarea
                value={rawInput}
                onChange={(e) => setRawInput(e.target.value)}
                placeholder="示例：&#10;SKU-001  男士运动透气网面鞋&#10;SKU-002  智能降噪蓝牙耳机..."
                className="flex-grow w-full h-80 p-4 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition resize-none bg-gray-50 font-mono text-sm leading-relaxed"
              />
              <div className="mt-6">
                <button
                  onClick={handleProcess}
                  disabled={status.isProcessing || !rawInput.trim()}
                  className={`
                    w-full flex items-center justify-center gap-2 py-4 rounded-xl font-bold shadow-lg transition-all
                    ${status.isProcessing || !rawInput.trim() 
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed shadow-none' 
                      : 'bg-blue-600 text-white hover:bg-blue-700 active:scale-95'}
                  `}
                >
                  {status.isProcessing ? (
                    <>
                      <Loader2 className="animate-spin" size={20} />
                      {isWaitingForNextBatch ? '正在切换下一批...' : `处理中 ${status.completed}/${status.total}`}
                    </>
                  ) : (
                    <>
                      <Play size={20} fill="currentColor" />
                      立即开始 ({provider === 'gemini' ? 'Gemini' : 'DeepSeek'})
                    </>
                  )}
                </button>
              </div>
            </section>
          </div>

          {/* Right: Results */}
          <div className="lg:col-span-2 space-y-6">
            {status.error && (
              <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex items-center gap-3 text-amber-800 animate-in slide-in-from-top-2">
                <AlertCircle size={20} className="shrink-0" />
                <div className="text-sm">
                  <p className="font-bold">生成异常</p>
                  <p className="opacity-90">{status.error}</p>
                </div>
              </div>
            )}

            {results.length > 0 ? (
              <section className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col h-full">
                <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-center gap-4 bg-gray-50/50">
                  <div className="flex items-center gap-2">
                    {status.isProcessing ? (
                       <div className="flex items-center gap-2 text-blue-600">
                         <Clock size={18} className="animate-pulse" />
                         <span className="font-bold text-sm">正在增量生成，请稍候...</span>
                       </div>
                    ) : (
                      <div className="flex items-center gap-2 text-green-600">
                        <CheckCircle2 size={18} />
                        <span className="font-bold text-sm">已就绪 ({results.length} 条)</span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <button
                      onClick={copyToExcel}
                      className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-black transition text-sm font-bold shadow-sm"
                    >
                      <ClipboardCheck size={16} /> 复制
                    </button>
                    <button
                      onClick={downloadCSV}
                      className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 border border-gray-200 bg-white rounded-lg hover:bg-gray-50 transition text-sm font-bold shadow-sm"
                    >
                      <FileDown size={16} /> 导出
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse table-fixed min-w-[800px]">
                    <thead className="bg-gray-50 border-b border-gray-100">
                      <tr>
                        <th className="w-24 p-4 text-xs font-bold text-gray-500 uppercase">SKU</th>
                        <th className="w-40 p-4 text-xs font-bold text-gray-500 uppercase">中文原名</th>
                        <th className="w-56 p-4 text-xs font-bold text-gray-500 uppercase">俄语名称 (SEO)</th>
                        <th className="p-4 text-xs font-bold text-gray-500 uppercase">俄语简介</th>
                        <th className="w-40 p-4 text-xs font-bold text-gray-500 uppercase">对照翻译</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {results.map((result, idx) => (
                        <tr key={`${result.sku}-${idx}`} className="hover:bg-blue-50/30 transition animate-in fade-in slide-in-from-left-2">
                          <td className="p-4 align-top">
                            <code className="text-[10px] font-mono bg-gray-100 px-1 py-0.5 rounded text-gray-500 break-all">{result.sku}</code>
                          </td>
                          <td className="p-4 align-top text-xs text-gray-700 leading-relaxed">{result.chineseName}</td>
                          <td className="p-4 align-top text-xs text-blue-700 font-bold italic leading-relaxed break-words">
                            {result.russianName}
                          </td>
                          <td className="p-4 align-top text-xs text-gray-600 leading-relaxed whitespace-pre-wrap">
                            {result.russianDescription}
                          </td>
                          <td className="p-4 align-top text-xs text-green-700 font-medium">
                            {result.backTranslation}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ) : !status.isProcessing && (
              <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 h-[500px] flex flex-col items-center justify-center opacity-40">
                <Table size={64} className="text-gray-300 mb-4" />
                <p className="text-gray-500 font-bold text-lg">等待数据处理...</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <footer className="max-w-7xl mx-auto mt-12 py-8 border-t border-gray-200 flex flex-col sm:flex-row justify-between items-center text-gray-400 text-xs gap-4">
        <p>© {new Date().getFullYear()} Ozon SEO 助手 - 您的跨境出海 AI 专家</p>
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1"><ShieldCheck size={12} /> 多引擎支持 (Gemini/DeepSeek)</span>
          <span className="flex items-center gap-1"><CheckCircle2 size={12} /> 支持断点输出与数据安全</span>
        </div>
      </footer>
    </div>
  );
};

export default App;
