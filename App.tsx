
import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Inbox, 
  Settings as SettingsIcon, 
  CheckCircle, 
  XCircle, 
  Loader2,
  RefreshCw,
  Share2,
  MessageSquare,
  Link2,
  UserCheck,
  Radio,
  Plus,
  Trash2,
  Server,
  Rocket,
  Zap
} from 'lucide-react';
import { Platform, Article, PostingStatus, Source, Account } from './types';
import { rewriteArticle, generateImageForArticle, extractKeyConcepts } from './geminiService';
import { postToPlatforms, fetchInbox } from './apiService';

const INITIAL_ACCOUNTS: Account[] = [
  { id: 'a1', platform: Platform.TELEGRAM, username: 'Connected Bot', status: 'connected', lastPostDate: 'Active' },
  { id: 'a2', platform: Platform.VK, username: 'Pending Config', status: 'expired', lastPostDate: '-' },
];

const SidebarItem: React.FC<{ icon: React.ReactNode; label: string; active: boolean; onClick: () => void; }> = ({ icon, label, active, onClick }) => (
  <button onClick={onClick} className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all ${active ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}>
    {icon} <span className="font-medium">{label}</span>
  </button>
);

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'inbox' | 'sources' | 'accounts' | 'settings'>('inbox');
  const [articles, setArticles] = useState<Article[]>([]);
  
  // Управление источниками
  const [sources, setSources] = useState<Source[]>(() => {
    const saved = localStorage.getItem('omni_sources');
    return saved ? JSON.parse(saved) : [
        { id: '1', name: 'Default Channel', url: '@durov', type: 'channel', isActive: true }
    ];
  });
  const [newSourceUrl, setNewSourceUrl] = useState('');

  const [accounts] = useState<Account[]>(INITIAL_ACCOUNTS);
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [postingProgress, setPostingProgress] = useState<PostingStatus[]>([]);
  
  const [apiToken] = useState(localStorage.getItem('api_token') || '');

  useEffect(() => {
    localStorage.setItem('omni_sources', JSON.stringify(sources));
  }, [sources]);

  const loadInbox = async () => {
    setIsFetching(true);
    try {
        // Передаем список URL наших каналов на бэкенд
        const channelUrls = sources.filter(s => s.isActive).map(s => s.url);
        const data = await fetchInbox(channelUrls);
        setArticles(data);
    } catch (e) {
        console.error(e);
    } finally {
        setIsFetching(false);
    }
  };

  useEffect(() => {
    loadInbox();
  }, []);

  const addSource = () => {
    if (!newSourceUrl.trim()) return;
    const newSource: Source = {
        id: Date.now().toString(),
        name: newSourceUrl.replace('@', ''),
        url: newSourceUrl.startsWith('@') ? newSourceUrl : `@${newSourceUrl}`,
        type: 'channel',
        isActive: true
    };
    setSources([...sources, newSource]);
    setNewSourceUrl('');
  };

  const removeSource = (id: string) => {
    setSources(sources.filter(s => s.id !== id));
  };

  const handleApprove = async (article: Article) => {
    setIsProcessing(true);
    try {
      const rewritten = await rewriteArticle(article.originalText);
      const keywords = await extractKeyConcepts(article.originalText);
      const imageUrl = await generateImageForArticle(keywords.join(", "));
      
      const updatedArticle: Article = {
        ...article,
        status: 'approved',
        rewrittenText: rewritten,
        generatedImageUrl: imageUrl,
        platforms: accounts.filter(acc => acc.status === 'connected').map(acc => acc.platform)
      };

      setArticles(prev => prev.map(a => a.id === article.id ? updatedArticle : a));
      setSelectedArticle(updatedArticle);
    } catch (error) {
      alert("AI Processing Error. Check your API Key.");
    } finally {
      setIsProcessing(false);
    }
  };

  const deployContent = async () => {
    if (!selectedArticle) return;
    const targetPlatforms = selectedArticle.platforms || [];
    setPostingProgress(targetPlatforms.map(p => ({ platform: p, status: 'uploading' })));

    try {
      await postToPlatforms(selectedArticle, targetPlatforms);
      setPostingProgress(targetPlatforms.map(p => ({ platform: p, status: 'success' })));
      setArticles(prev => prev.map(a => a.id === selectedArticle.id ? { ...a, status: 'posted' } : a));
      setTimeout(() => {
        setSelectedArticle(null);
        setPostingProgress([]);
      }, 2000);
    } catch (e: any) {
      alert("Publishing Error: " + e.message);
      setPostingProgress(targetPlatforms.map(p => ({ platform: p, status: 'failed' })));
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-slate-950 text-slate-200">
      <aside className="w-72 glass border-r border-slate-800 flex flex-col p-6 space-y-8 z-20">
        <div className="flex items-center space-x-3 px-2">
          <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-2.5 rounded-2xl shadow-lg shadow-indigo-500/20"><Radio className="w-6 h-6 text-white" /></div>
          <div>
            <h1 className="text-xl font-black tracking-tight leading-none">OmniPost</h1>
            <span className="text-[10px] text-indigo-400 font-bold tracking-widest uppercase italic">On-Demand AI</span>
          </div>
        </div>
        <nav className="flex-1 space-y-1.5">
          <SidebarItem icon={<Inbox size={20} />} label="Inbound Feed" active={activeTab === 'inbox'} onClick={() => setActiveTab('inbox')} />
          <SidebarItem icon={<Link2 size={20} />} label="Sources" active={activeTab === 'sources'} onClick={() => setActiveTab('sources')} />
          <SidebarItem icon={<UserCheck size={20} />} label="Accounts" active={activeTab === 'accounts'} onClick={() => setActiveTab('accounts')} />
          <SidebarItem icon={<LayoutDashboard size={20} />} label="Stats" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
          <SidebarItem icon={<SettingsIcon size={20} />} label="Config" active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} />
        </nav>
        <button 
            onClick={loadInbox} 
            disabled={isFetching}
            className="p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 hover:bg-indigo-500/20 transition-all flex items-center justify-center gap-2 text-xs font-bold text-indigo-400"
        >
           {isFetching ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} />}
           Scan {sources.length} Channels
        </button>
      </aside>

      <main className="flex-1 overflow-y-auto relative">
        <header className="sticky top-0 z-10 glass px-10 py-5 flex justify-between items-center border-b border-slate-800/50">
          <h2 className="text-lg font-bold tracking-tight text-white capitalize">{activeTab}</h2>
          <div className="flex items-center gap-4">
             <div className="text-[10px] font-bold text-slate-400 bg-slate-800 px-4 py-2 rounded-full border border-slate-700">
               {sources.length} Channels Tracked
             </div>
             <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center font-bold text-white shadow-xl shadow-indigo-600/20">A</div>
          </div>
        </header>

        <div className="p-10 max-w-7xl mx-auto">
          {activeTab === 'inbox' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              {articles.map(article => (
                <div key={article.id} className="glass p-8 rounded-[32px] border border-slate-800/50 hover:border-indigo-500/30 transition-all group">
                  <div className="flex justify-between items-center mb-6">
                    <span className="text-[10px] font-black tracking-widest text-indigo-400 uppercase bg-indigo-500/5 px-2 py-1 rounded-lg border border-indigo-500/10">{article.source}</span>
                    <span className="text-[10px] text-slate-600 font-mono">{article.timestamp}</span>
                  </div>
                  <p className="text-slate-300 text-sm leading-relaxed mb-8 line-clamp-4">{article.originalText}</p>
                  <button 
                    onClick={() => handleApprove(article)} 
                    className="w-full py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-500 font-bold text-white transition-all flex items-center justify-center gap-2"
                  >
                    <Rocket size={16} /> Process with AI
                  </button>
                </div>
              ))}
              {articles.length === 0 && !isFetching && (
                <div className="col-span-full py-20 text-center opacity-40">
                    <Inbox size={48} className="mx-auto mb-4" />
                    <p>Inbox is empty. Add channels in "Sources" tab.</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'sources' && (
            <div className="max-w-3xl mx-auto space-y-6">
                <div className="glass p-8 rounded-[32px] border border-slate-800 flex gap-4">
                    <input 
                        value={newSourceUrl}
                        onChange={(e) => setNewSourceUrl(e.target.value)}
                        className="flex-1 bg-slate-900 border border-slate-800 rounded-2xl px-6 py-4 focus:border-indigo-500 focus:outline-none"
                        placeholder="Enter channel @username..."
                        onKeyDown={(e) => e.key === 'Enter' && addSource()}
                    />
                    <button 
                        onClick={addSource}
                        className="bg-indigo-600 px-8 rounded-2xl font-bold flex items-center gap-2 hover:bg-indigo-500 transition-all"
                    >
                        <Plus size={20} /> Add
                    </button>
                </div>

                <div className="grid grid-cols-1 gap-4">
                    {sources.map(source => (
                        <div key={source.id} className="glass p-6 rounded-2xl border border-slate-800 flex items-center justify-between group hover:border-slate-700 transition-all">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-xl bg-slate-800 flex items-center justify-center text-indigo-400">
                                    <Radio size={24} />
                                </div>
                                <div>
                                    <h4 className="font-bold text-white">{source.name}</h4>
                                    <p className="text-xs text-slate-500">{source.url}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="text-[10px] font-bold text-emerald-500 bg-emerald-500/10 px-3 py-1 rounded-full uppercase">Monitoring</span>
                                <button 
                                    onClick={() => removeSource(source.id)}
                                    className="p-3 text-slate-600 hover:text-red-400 hover:bg-red-400/10 rounded-xl transition-all"
                                >
                                    <Trash2 size={18} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="max-w-2xl mx-auto glass p-12 rounded-[40px] border border-slate-800 space-y-8">
                <h3 className="text-xl font-bold flex items-center gap-3"><Server className="text-indigo-500" /> API Configuration</h3>
                <div className="space-y-4">
                    <div className="text-xs text-slate-500 leading-relaxed bg-slate-900/50 p-4 rounded-xl border border-slate-800">
                        {"To enable real Telegram integration, go to your "}<b>Vercel Project Settings → Environment Variables</b>{" and add:"}<br/><br/>
                        <code>TELEGRAM_BOT_TOKEN</code><br/>
                    </div>
                    <p className="text-sm text-slate-400 italic">
                        Note: The bot must be an administrator in the channels you want to monitor.
                    </p>
                </div>
            </div>
          )}
        </div>
      </main>

      {/* Preview Modal */}
      {selectedArticle && !isProcessing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-950/90 backdrop-blur-xl">
           <div className="glass w-full max-w-5xl max-h-[90vh] rounded-[40px] border border-white/5 overflow-hidden flex shadow-2xl">
              <div className="w-2/3 p-12 overflow-y-auto border-r border-slate-800">
                 <div className="flex items-center justify-between mb-10">
                    <h3 className="text-2xl font-bold text-white">AI Content Preview</h3>
                    <button onClick={() => setSelectedArticle(null)} className="p-2 hover:bg-slate-800 rounded-full transition-all"><XCircle size={24} /></button>
                 </div>
                 <div className="space-y-8">
                    {selectedArticle.generatedImageUrl && (
                        <div className="rounded-3xl overflow-hidden border border-slate-800 shadow-xl">
                            <img src={selectedArticle.generatedImageUrl} className="w-full object-cover" />
                        </div>
                    )}
                    <div className="bg-slate-900/50 p-8 rounded-3xl border border-slate-800 leading-relaxed text-lg text-slate-200">
                        {selectedArticle.rewrittenText}
                    </div>
                 </div>
              </div>

              <div className="w-1/3 p-12 flex flex-col bg-slate-950/50">
                 <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-8">Publish Targets</h4>
                 <div className="flex-1 space-y-3">
                    {accounts.map(acc => (
                       <div key={acc.id} className="flex items-center justify-between p-4 rounded-2xl bg-slate-900/50 border border-slate-800">
                          <span className="text-sm font-bold">{acc.platform}</span>
                          {postingProgress.find(p => p.platform === acc.platform)?.status === 'uploading' ? (
                             <Loader2 size={18} className="animate-spin text-indigo-400" />
                          ) : postingProgress.find(p => p.platform === acc.platform)?.status === 'success' ? (
                             <CheckCircle size={18} className="text-emerald-400" />
                          ) : (
                             <div className={`w-2 h-2 rounded-full ${acc.status === 'connected' ? 'bg-emerald-500' : 'bg-slate-700'}`}></div>
                          )}
                       </div>
                    ))}
                 </div>
                 
                 <button 
                    onClick={deployContent}
                    disabled={postingProgress.length > 0}
                    className="w-full py-5 mt-10 bg-indigo-600 hover:bg-indigo-500 rounded-2xl font-bold text-lg shadow-xl shadow-indigo-600/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                 >
                    {postingProgress.length > 0 ? <Loader2 className="animate-spin" /> : <Share2 size={20} />}
                    Post Now
                 </button>
              </div>
           </div>
        </div>
      )}

      {isProcessing && (
        <div className="fixed inset-0 z-[100] bg-slate-950/80 backdrop-blur-md flex flex-col items-center justify-center">
           <div className="w-20 h-20 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin mb-6"></div>
           <p className="text-indigo-400 font-bold animate-pulse">Gemini AI is crafting your post...</p>
        </div>
      )}
    </div>
  );
};

export default App;
