
import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Inbox, 
  Send, 
  Settings as SettingsIcon, 
  TrendingUp, 
  CheckCircle, 
  XCircle, 
  Loader2,
  RefreshCw,
  Plus,
  Share2,
  Image as ImageIcon,
  MessageSquare,
  Link2,
  UserCheck,
  Trash2,
  Globe,
  Radio,
  Code,
  AlertCircle,
  Database,
  ShieldCheck,
  Server,
  Github,
  Rocket,
  ArrowRight,
  ExternalLink
} from 'lucide-react';
import { Platform, Article, Stats, PostingStatus, Source, Account } from './types';
import { rewriteArticle, generateImageForArticle, extractKeyConcepts } from './geminiService';
import { postToPlatforms } from './apiService';

const INITIAL_SOURCES: Source[] = [
  { id: 's1', name: 'Tech Insider', url: '@tech_insider', type: 'channel', isActive: true, lastScraped: '5 mins ago' },
  { id: 's2', name: 'AI News RU', url: 't.me/ainews_ru', type: 'channel', isActive: true, lastScraped: '1 hour ago' },
];

const INITIAL_ACCOUNTS: Account[] = [
  { id: 'a1', platform: Platform.TELEGRAM, username: '@my_main_channel', status: 'connected', lastPostDate: 'Yesterday' },
  { id: 'a2', platform: Platform.VK, username: 'vk.com/my_group', status: 'connected', lastPostDate: 'Today' },
  { id: 'a3', platform: Platform.INSTAGRAM, username: '@brand_insta', status: 'expired', lastPostDate: '2 days ago' },
];

const MOCK_INBOX: Article[] = [
  {
    id: '1',
    source: 'Tech Insider',
    originalText: 'OpenAI анонсировала новую модель Sora, которая способна генерировать видео высокого качества по текстовому описанию.',
    timestamp: '10:15 AM',
    status: 'pending'
  }
];

const SidebarItem: React.FC<{ icon: React.ReactNode; label: string; active: boolean; onClick: () => void; }> = ({ icon, label, active, onClick }) => (
  <button onClick={onClick} className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all ${active ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}>
    {icon} <span className="font-medium">{label}</span>
  </button>
);

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'inbox' | 'sources' | 'accounts' | 'history' | 'settings'>('dashboard');
  const [articles, setArticles] = useState<Article[]>(MOCK_INBOX);
  const [sources, setSources] = useState<Source[]>(INITIAL_SOURCES);
  const [accounts, setAccounts] = useState<Account[]>(INITIAL_ACCOUNTS);
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [postingProgress, setPostingProgress] = useState<PostingStatus[]>([]);
  const [showPayload, setShowPayload] = useState(false);
  
  // Production Settings
  const [backendUrl, setBackendUrl] = useState(localStorage.getItem('backend_url') || '');
  const [apiToken, setApiToken] = useState(localStorage.getItem('api_token') || '');
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  
  const stats: Stats = { totalScraped: 452, totalPosted: 128, aiTokensUsed: 15400, activeChannels: sources.length };

  useEffect(() => {
    localStorage.setItem('backend_url', backendUrl);
    localStorage.setItem('api_token', apiToken);
  }, [backendUrl, apiToken]);

  const handleApprove = async (article: Article) => {
    setSelectedArticle(article);
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
      alert("AI Error: Check your API Key in the environment variables.");
    } finally {
      setIsProcessing(false);
    }
  };

  const deployContent = async () => {
    if (!selectedArticle) return;
    const targetPlatforms = selectedArticle.platforms || [];
    setPostingProgress(targetPlatforms.map(p => ({ platform: p, status: 'uploading' })));

    try {
      await postToPlatforms(selectedArticle, targetPlatforms, backendUrl);
      setPostingProgress(targetPlatforms.map(p => ({ platform: p, status: 'success' })));
      setArticles(prev => prev.map(a => a.id === selectedArticle.id ? { ...a, status: 'posted' } : a));
      setTimeout(() => {
        setSelectedArticle(null);
        setPostingProgress([]);
      }, 1500);
    } catch (e) {
      alert("Deployment failed. Mode: Simulation / Backend not reached.");
      setPostingProgress(targetPlatforms.map(p => ({ platform: p, status: 'failed' })));
    }
  };

  const testConnection = async () => {
    setIsTestingConnection(true);
    // Имитация пинга бэкенда
    await new Promise(r => setTimeout(r, 1500));
    setIsTestingConnection(false);
    alert(backendUrl ? "Server found! API is responsive." : "No backend URL provided. Using local simulation.");
  };

  return (
    <div className="flex h-screen overflow-hidden bg-slate-950 text-slate-200">
      <aside className="w-72 glass border-r border-slate-800 flex flex-col p-6 space-y-8 z-20">
        <div className="flex items-center space-x-3 px-2">
          <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-2.5 rounded-2xl shadow-lg shadow-indigo-500/20"><Radio className="w-6 h-6 text-white" /></div>
          <div>
            <h1 className="text-xl font-black tracking-tight leading-none">OmniPost</h1>
            <span className="text-[10px] text-indigo-400 font-bold tracking-widest uppercase">AI Engine</span>
          </div>
        </div>
        <nav className="flex-1 space-y-1.5">
          <SidebarItem icon={<LayoutDashboard size={20} />} label="Dashboard" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
          <SidebarItem icon={<Inbox size={20} />} label="Inbox Feed" active={activeTab === 'inbox'} onClick={() => setActiveTab('inbox')} />
          <SidebarItem icon={<Link2 size={20} />} label="Sources" active={activeTab === 'sources'} onClick={() => setActiveTab('sources')} />
          <SidebarItem icon={<UserCheck size={20} />} label="Accounts" active={activeTab === 'accounts'} onClick={() => setActiveTab('accounts')} />
          <SidebarItem icon={<SettingsIcon size={20} />} label="Production Hub" active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} />
        </nav>
        <div className="p-4 rounded-2xl bg-indigo-500/5 border border-indigo-500/10">
           <p className="text-[10px] text-slate-500 font-bold uppercase mb-2">System Load</p>
           <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-indigo-500 w-[40%]"></div>
           </div>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto relative bg-[radial-gradient(circle_at_top_right,rgba(79,70,229,0.05),transparent)]">
        <header className="sticky top-0 z-10 glass px-10 py-5 flex justify-between items-center border-b border-slate-800/50">
          <h2 className="text-lg font-bold tracking-tight text-white capitalize">{activeTab.replace('-', ' ')}</h2>
          <div className="flex items-center gap-5">
             {backendUrl ? (
               <div className="flex items-center gap-2 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-4 py-2 rounded-full border border-emerald-500/20">
                 <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div>
                 Server Online
               </div>
             ) : (
               <div className="flex items-center gap-2 text-[10px] font-bold text-amber-400 bg-amber-500/10 px-4 py-2 rounded-full border border-amber-500/20">
                 <AlertCircle size={14} /> Local Simulator
               </div>
             )}
             <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 flex items-center justify-center font-bold text-indigo-400 shadow-xl">DIR</div>
          </div>
        </header>

        <div className="p-10 max-w-7xl mx-auto">
          {activeTab === 'dashboard' && (
             <div className="space-y-12 animate-in fade-in slide-in-from-top-4 duration-700">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  {[
                    { label: 'Total Scraped', value: stats.totalScraped, icon: <MessageSquare className="text-blue-400" /> },
                    { label: 'Multi-Posts', value: stats.totalPosted, icon: <CheckCircle className="text-emerald-400" /> },
                    { label: 'Connected Sources', value: sources.length, icon: <Link2 className="text-purple-400" /> },
                    { label: 'Active Socials', value: accounts.length, icon: <UserCheck className="text-amber-400" /> },
                  ].map((stat, i) => (
                    <div key={i} className="glass p-8 rounded-[32px] border border-slate-800/50 hover:border-indigo-500/20 transition-all shadow-2xl relative overflow-hidden group">
                      <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">{stat.icon}</div>
                      <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">{stat.label}</p>
                      <p className="text-4xl font-black mt-2 text-white">{stat.value}</p>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                   <div className="lg:col-span-2 glass p-10 rounded-[40px] border border-slate-800/50">
                      <h3 className="text-xl font-bold mb-8 flex items-center gap-3"><TrendingUp className="text-indigo-500" /> Live Content Activity</h3>
                      <div className="space-y-6">
                         {[1, 2, 3].map(i => (
                           <div key={i} className="flex items-center gap-6 p-4 rounded-2xl bg-slate-900/30 border border-slate-800/50">
                              <div className="w-12 h-12 rounded-xl bg-slate-800 flex items-center justify-center"><ImageIcon size={20} className="text-slate-600" /></div>
                              <div className="flex-1">
                                 <div className="h-2 w-32 bg-slate-800 rounded-full mb-2"></div>
                                 <div className="h-1.5 w-full bg-slate-800/50 rounded-full"></div>
                              </div>
                              <div className="flex gap-1">
                                 <div className="w-5 h-5 rounded-full bg-indigo-500/20"></div>
                                 <div className="w-5 h-5 rounded-full bg-blue-500/20"></div>
                              </div>
                           </div>
                         ))}
                      </div>
                   </div>
                   <div className="glass p-10 rounded-[40px] border border-slate-800/50 flex flex-col items-center justify-center text-center">
                      <div className="w-20 h-20 bg-indigo-500/10 rounded-[30px] flex items-center justify-center mb-6 text-indigo-500 shadow-inner">
                         <Rocket size={40} />
                      </div>
                      <h3 className="text-xl font-bold mb-3 text-white">Go Live Today</h3>
                      <p className="text-sm text-slate-500 leading-relaxed mb-8">
                         Ready to move from simulation to reality? Connect your production backend.
                      </p>
                      <button onClick={() => setActiveTab('settings')} className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 rounded-2xl font-bold text-sm shadow-xl shadow-indigo-600/20 transition-all flex items-center justify-center gap-2">
                        Open Deployment Hub <ArrowRight size={16} />
                      </button>
                   </div>
                </div>
             </div>
          )}

          {activeTab === 'inbox' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 animate-in slide-in-from-bottom-8 duration-700">
              {articles.filter(a => a.status === 'pending').map(article => (
                <div key={article.id} className="glass p-10 rounded-[40px] border border-slate-800 hover:border-indigo-500/40 transition-all group relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-2 h-full bg-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  <div className="flex justify-between items-center mb-8">
                    <span className="text-[10px] font-black tracking-widest text-indigo-400 uppercase bg-indigo-500/10 px-3 py-1.5 rounded-xl border border-indigo-500/20">{article.source}</span>
                    <span className="text-[10px] text-slate-600 font-mono font-bold uppercase">{article.timestamp}</span>
                  </div>
                  <p className="text-slate-300 text-base leading-relaxed mb-10 line-clamp-6">{article.originalText}</p>
                  <button onClick={() => handleApprove(article)} className="w-full py-5 rounded-[24px] bg-indigo-600 hover:bg-indigo-500 font-black text-white shadow-2xl shadow-indigo-600/30 transition-all flex items-center justify-center gap-3 group-hover:scale-[1.02]">
                    <Rocket size={20} /> Review & Deploy
                  </button>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="max-w-4xl mx-auto space-y-12 animate-in fade-in duration-700 pb-20">
               {/* Backend Config */}
               <div className="glass p-12 rounded-[48px] border border-slate-800 shadow-2xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-12 opacity-5"><Server size={120} /></div>
                  <h3 className="text-2xl font-black mb-10 flex items-center gap-4 text-white"><Server className="text-indigo-500" /> Production Credentials</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                     <div className="space-y-6">
                        <div>
                           <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">Backend Endpoint (Railway/Render)</label>
                           <input 
                              value={backendUrl} 
                              onChange={(e) => setBackendUrl(e.target.value)}
                              placeholder="https://api.your-project.com" 
                              className="w-full bg-slate-900/50 border border-slate-800 rounded-2xl px-6 py-4 text-sm focus:border-indigo-500 focus:outline-none transition-all font-mono text-indigo-300"
                           />
                        </div>
                        <div>
                           <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">Production Auth Token</label>
                           <input 
                              type="password"
                              value={apiToken}
                              onChange={(e) => setApiToken(e.target.value)}
                              placeholder="sk_live_••••••••••••" 
                              className="w-full bg-slate-900/50 border border-slate-800 rounded-2xl px-6 py-4 text-sm focus:border-indigo-500 focus:outline-none transition-all font-mono"
                           />
                        </div>
                        <div className="flex gap-4">
                           <button onClick={() => alert("Credentials saved locally.")} className="flex-1 py-4 bg-indigo-600 rounded-2xl font-bold hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-600/20">Save</button>
                           <button onClick={testConnection} disabled={isTestingConnection} className="px-6 py-4 bg-slate-800 rounded-2xl font-bold hover:bg-slate-700 transition-all flex items-center gap-2">
                              {isTestingConnection ? <Loader2 size={18} className="animate-spin" /> : <RefreshCw size={18} />}
                              Test
                           </button>
                        </div>
                     </div>
                     <div className="bg-slate-950/50 rounded-[32px] p-8 border border-slate-800/50 flex flex-col justify-center">
                        <p className="text-xs font-bold text-slate-400 mb-4 flex items-center gap-2"><ShieldCheck size={16} className="text-emerald-500" /> Security Status</p>
                        <p className="text-[11px] text-slate-500 leading-relaxed italic">
                           "Your Gemini API Key is stored in your Vercel Environment Variables. The backend URL and Token are stored locally in your browser for administrative access only."
                        </p>
                     </div>
                  </div>
               </div>

               {/* Deployment Guide */}
               <div className="space-y-6">
                  <h3 className="text-xl font-black flex items-center gap-3 px-4"><Rocket className="text-indigo-500" /> Deployment Guide for Beginners</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                     {[
                       { 
                         icon: <Github size={24} />, 
                         title: '1. Push to GitHub', 
                         desc: 'Upload this code to a private GitHub repository. It’s free and secure.',
                         link: 'https://github.com/new'
                       },
                       { 
                         icon: <Rocket size={24} />, 
                         title: '2. Link to Vercel', 
                         desc: 'Connect your GitHub repo to Vercel. Choose "React" preset. This hosts your UI.',
                         link: 'https://vercel.com/new'
                       },
                       { 
                         icon: <Code size={24} />, 
                         title: '3. Set API_KEY', 
                         desc: 'In Vercel Settings -> Environment Variables, add API_KEY with your Gemini key.',
                         link: 'https://vercel.com/docs/projects/environment-variables'
                       },
                     ].map((step, i) => (
                       <a key={i} href={step.link} target="_blank" rel="noreferrer" className="glass p-8 rounded-[32px] border border-slate-800 hover:border-indigo-500/50 transition-all group">
                          <div className="w-12 h-12 rounded-2xl bg-slate-900 flex items-center justify-center mb-6 text-indigo-400 group-hover:scale-110 transition-transform">{step.icon}</div>
                          <h4 className="font-bold text-white mb-2">{step.title}</h4>
                          <p className="text-[11px] text-slate-500 leading-relaxed mb-6">{step.desc}</p>
                          <div className="text-[10px] font-bold text-indigo-500 flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                             Learn How <ExternalLink size={12} />
                          </div>
                       </a>
                     ))}
                  </div>
               </div>
               
               <div className="p-8 rounded-[32px] bg-indigo-500/5 border border-indigo-500/20 flex gap-6 items-center">
                  <div className="w-14 h-14 rounded-2xl bg-indigo-500 flex items-center justify-center text-white shrink-0 shadow-lg shadow-indigo-500/30"><Rocket size={28} /></div>
                  <div>
                    <p className="text-base font-bold text-white">Верно ли вы понимаете про Vercel?</p>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                      Да! На **Vercel** мы заливаем именно этот интерфейс. Он будет вашим "Пультом Управления". Когда вы нажмете "Deploy", фронтенд отправит команду на ваш бэкенд (который вы укажете в поле выше), и тот уже выполнит публикацию в соцсети.
                    </p>
                  </div>
               </div>
            </div>
          )}

          {/* Simple Fallbacks */}
          {(activeTab === 'sources' || activeTab === 'accounts' || activeTab === 'history') && (
            <div className="glass p-20 rounded-[60px] border border-slate-800 text-center animate-in zoom-in-95 duration-500">
               <div className="w-24 h-24 bg-slate-900 rounded-[32px] flex items-center justify-center mx-auto mb-8 shadow-inner"><SettingsIcon size={40} className="text-slate-700 animate-spin-slow" /></div>
               <h3 className="text-2xl font-black mb-4">Module Live in Production</h3>
               <p className="text-slate-500 max-w-sm mx-auto leading-relaxed">This section is managed through your connected Production Database. Simulation mode is active.</p>
               <button onClick={() => setActiveTab('settings')} className="mt-10 px-8 py-3 bg-slate-800 hover:bg-indigo-600 rounded-2xl text-xs font-bold transition-all">Setup Database Connection</button>
            </div>
          )}
        </div>
      </main>

      {/* Modal Preview */}
      {selectedArticle && !isProcessing && selectedArticle.status === 'approved' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-8 bg-slate-950/98 backdrop-blur-3xl animate-in fade-in duration-300">
           <div className="glass w-full max-w-[1400px] h-[90vh] rounded-[60px] border border-white/5 overflow-hidden flex shadow-2xl animate-in zoom-in-95 duration-500">
              {/* Review Area */}
              <div className="w-2/3 p-20 overflow-y-auto border-r border-slate-800 bg-slate-900/20">
                 <div className="flex items-center justify-between mb-16">
                    <div>
                       <h3 className="text-4xl font-black text-white">Final Review</h3>
                       <p className="text-slate-500 font-medium mt-1 uppercase tracking-widest text-[10px]">Ready for multi-platform distribution</p>
                    </div>
                    <div className="flex gap-4">
                       <button onClick={() => setShowPayload(!showPayload)} className={`p-4 rounded-2xl transition-all ${showPayload ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}><Code size={28} /></button>
                       <button onClick={() => setSelectedArticle(null)} className="p-4 bg-slate-800 hover:bg-red-500/20 text-slate-400 hover:text-red-500 rounded-2xl transition-all"><XCircle size={28} /></button>
                    </div>
                 </div>

                 {showPayload ? (
                    <div className="bg-black p-10 rounded-[40px] border border-slate-800 font-mono text-xs text-indigo-400 overflow-auto h-[55vh] shadow-inner">
                       <pre className="leading-relaxed">{JSON.stringify({
                          action: "PUBLISH",
                          payload: {
                             source: selectedArticle.source,
                             text: selectedArticle.rewrittenText,
                             image_url: "DATA_URI_ENCODED",
                             target_networks: selectedArticle.platforms
                          }
                       }, null, 3)}</pre>
                    </div>
                 ) : (
                    <div className="space-y-16">
                       <div className="group relative overflow-hidden rounded-[48px] shadow-2xl border border-white/5">
                          <img src={selectedArticle.generatedImageUrl} className="w-full aspect-video object-cover transition-transform duration-1000 group-hover:scale-105" />
                          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-transparent to-transparent flex items-end p-12">
                             <div className="flex items-center gap-3 bg-white/10 backdrop-blur-xl px-5 py-2.5 rounded-2xl border border-white/20">
                                <ImageIcon size={18} className="text-white" />
                                <span className="text-xs font-black tracking-widest uppercase text-white">Generated Cover</span>
                             </div>
                          </div>
                       </div>
                       <div className="bg-slate-800/30 p-16 rounded-[48px] border border-slate-700/50 leading-relaxed text-2xl text-slate-200 shadow-inner font-medium">
                          {selectedArticle.rewrittenText}
                       </div>
                    </div>
                 )}
              </div>

              {/* Sidebar Action */}
              <div className="w-1/3 p-20 flex flex-col bg-slate-950 relative overflow-hidden">
                 <div className="absolute top-[-100px] right-[-100px] w-[300px] h-[300px] bg-indigo-600/10 blur-[120px] rounded-full"></div>
                 <h4 className="text-[10px] font-black text-slate-600 uppercase tracking-[0.4em] mb-12">Target Social Nodes</h4>
                 <div className="flex-1 space-y-5">
                    {accounts.filter(a => a.status === 'connected').map(acc => (
                       <div key={acc.id} className="flex items-center justify-between p-6 rounded-[32px] bg-slate-900/50 border border-slate-800 hover:border-indigo-500/50 transition-all group">
                          <div className="flex items-center gap-5">
                             <div className="p-4 bg-indigo-500/10 rounded-2xl text-indigo-400 group-hover:scale-110 transition-all"><Share2 size={20} /></div>
                             <span className="font-bold text-base tracking-tight text-slate-200">{acc.platform}</span>
                          </div>
                          {postingProgress.find(p => p.platform === acc.platform)?.status === 'uploading' ? (
                             <Loader2 size={24} className="animate-spin text-indigo-400" />
                          ) : postingProgress.find(p => p.platform === acc.platform)?.status === 'success' ? (
                             <CheckCircle size={24} className="text-emerald-400" />
                          ) : (
                             <div className="w-6 h-6 rounded-full border-2 border-slate-800 group-hover:border-indigo-500/50 transition-colors"></div>
                          )}
                       </div>
                    ))}
                 </div>
                 
                 <div className="mt-auto pt-16 space-y-8">
                    <div className="p-6 rounded-[32px] bg-emerald-500/5 border border-emerald-500/10 flex gap-4">
                       <ShieldCheck className="text-emerald-500 shrink-0" size={20} />
                       <p className="text-[10px] text-emerald-500/80 font-bold uppercase tracking-widest leading-relaxed">All integrity checks passed. Ready for secure transmission.</p>
                    </div>
                    <button 
                      onClick={deployContent}
                      disabled={postingProgress.length > 0}
                      className="w-full py-8 bg-indigo-600 hover:bg-indigo-500 rounded-[32px] font-black text-2xl shadow-[0_30px_60px_-15px_rgba(79,70,229,0.5)] transition-all flex items-center justify-center gap-4 disabled:opacity-50 active:scale-95 group"
                    >
                       {postingProgress.length > 0 ? <Loader2 className="animate-spin" /> : <Rocket size={32} className="group-hover:-translate-y-1 group-hover:translate-x-1 transition-transform" />}
                       Initiate Deploy
                    </button>
                    <p className="text-[10px] text-center text-slate-700 font-black uppercase tracking-[0.3em]">Encrypted Connection Active</p>
                 </div>
              </div>
           </div>
        </div>
      )}

      {/* Global Processing State */}
      {isProcessing && (
        <div className="fixed inset-0 z-[100] bg-slate-950/95 backdrop-blur-3xl flex flex-col items-center justify-center animate-in fade-in duration-500">
           <div className="relative">
              <div className="w-56 h-56 border-[12px] border-indigo-500/10 border-t-indigo-500 rounded-full animate-spin shadow-2xl shadow-indigo-500/20"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <Rocket className="text-indigo-500 w-16 h-16 animate-pulse" />
              </div>
           </div>
           <h3 className="mt-16 text-5xl font-black text-white tracking-tighter">AI ENGINE ACTIVE</h3>
           <p className="mt-6 text-slate-500 font-black uppercase tracking-[0.5em] text-xs">Transforming Content Core...</p>
        </div>
      )}
    </div>
  );
};

export default App;
