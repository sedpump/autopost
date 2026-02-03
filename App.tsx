
import React, { useState, useEffect } from 'react';
import { 
  Inbox, 
  Settings as SettingsIcon, 
  CheckCircle, 
  XCircle, 
  Loader2,
  Share2,
  Link2,
  UserCheck,
  Radio,
  Plus,
  Trash2,
  Server,
  Rocket,
  Zap,
  Lock,
  LogOut,
  ChevronRight,
  Globe,
  Send,
  Hash,
  Image as ImageIcon
} from 'lucide-react';
import { Platform, Article, PostingStatus, Source, Account, User } from './types';
import { rewriteArticle, generateImageForArticle, extractKeyConcepts } from './geminiService';
import { 
  login, 
  fetchInbox, 
  fetchSources, 
  addSource, 
  deleteSource, 
  postToPlatforms,
  fetchAccounts,
  addAccount,
  deleteAccount
} from './apiService';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('omni_user');
    return saved ? JSON.parse(saved) : null;
  });
  
  const [activeTab, setActiveTab] = useState<'inbox' | 'sources' | 'accounts' | 'settings'>('inbox');
  const [articles, setArticles] = useState<Article[]>([]);
  const [sources, setSources] = useState<Source[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [newSourceUrl, setNewSourceUrl] = useState('');
  const [isFetching, setIsFetching] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  
  // Account Form State
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [newAccPlatform, setNewAccPlatform] = useState<Platform>(Platform.TELEGRAM);
  const [newAccName, setNewAccName] = useState('');
  const [newAccCreds, setNewAccCreds] = useState({ botToken: '', chatId: '' });

  // Auth Form State
  const [username, setUsername] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  useEffect(() => {
    if (user) {
      localStorage.setItem('omni_user', JSON.stringify(user));
      refreshData();
    }
  }, [user]);

  const refreshData = async () => {
    if (!user) return;
    setIsFetching(true);
    try {
      const [newArticles, newSources, newAccounts] = await Promise.all([
        fetchInbox(), 
        fetchSources(),
        fetchAccounts()
      ]);
      setArticles(newArticles);
      setSources(newSources);
      setAccounts(newAccounts);
    } catch (e) {
      console.error(e);
    } finally {
      setIsFetching(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;
    setAuthLoading(true);
    try {
      const userData = await login(username);
      setUser(userData);
    } catch (e) {
      alert("Login failed");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleAddSource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSourceUrl.trim()) return;
    try {
      await addSource(newSourceUrl);
      setNewSourceUrl('');
      refreshData();
    } catch (e) {
      alert("Failed to add source");
    }
  };

  const handleDeleteSource = async (id: string) => {
    if (!confirm("Are you sure?")) return;
    try {
      await deleteSource(id);
      refreshData();
    } catch (e) {
      alert("Failed to delete source");
    }
  };

  const handleAddAccount = async () => {
    try {
      await addAccount({
        platform: newAccPlatform,
        name: newAccName,
        credentials: newAccCreds
      });
      setShowAddAccount(false);
      refreshData();
    } catch (e) {
      alert("Error adding account");
    }
  };

  const handleApprove = async (article: Article) => {
    setIsProcessing(true);
    try {
      // 1. Рерайт текста (основная задача)
      const rewritten = await rewriteArticle(article.originalText);
      
      // 2. Генерация картинки (второстепенная, может упасть из-за лимитов)
      let imageUrl = '';
      try {
        const keywords = await extractKeyConcepts(article.originalText);
        if (keywords.length > 0) {
          imageUrl = await generateImageForArticle(keywords.join(", "));
        }
      } catch (imgError) {
        console.warn("Image generation failed, continuing with text only.", imgError);
      }
      
      const updatedArticle: Article = {
        ...article,
        status: 'approved',
        rewrittenText: rewritten,
        generatedImageUrl: imageUrl || undefined,
      };

      setArticles(prev => prev.map(a => a.id === article.id ? updatedArticle : a));
      setSelectedArticle(updatedArticle);
    } catch (error: any) {
      alert("AI Error: " + error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
        <div className="max-w-md w-full glass p-10 rounded-[40px] border border-white/5 shadow-2xl animate-in fade-in zoom-in duration-500">
          <div className="flex flex-col items-center mb-10">
            <div className="bg-indigo-600 p-4 rounded-3xl shadow-lg shadow-indigo-600/30 mb-6">
              <Lock className="text-white w-8 h-8" />
            </div>
            <h1 className="text-3xl font-black text-white mb-2">OmniPost AI</h1>
            <p className="text-slate-400 text-center">Cloud Content Distribution System</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <input 
              type="text" 
              placeholder="Username" 
              value={username}
              onChange={e => setUsername(e.target.value)}
              className="w-full bg-slate-900/50 border border-slate-800 rounded-2xl px-6 py-4 focus:border-indigo-500 focus:outline-none text-white"
            />
            <button 
              disabled={authLoading}
              className="w-full bg-indigo-600 hover:bg-indigo-500 py-4 rounded-2xl font-bold text-white transition-all flex items-center justify-center gap-2"
            >
              {authLoading ? <Loader2 className="animate-spin" /> : "Sign In"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-950 text-slate-200">
      <aside className="w-72 glass border-r border-slate-800 flex flex-col p-6 space-y-8 z-20">
        <div className="flex items-center space-x-3 px-2">
          <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-2.5 rounded-2xl shadow-lg shadow-indigo-500/20"><Radio className="w-6 h-6 text-white" /></div>
          <div>
            <h1 className="text-xl font-black tracking-tight leading-none text-white">OmniPost</h1>
            <span className="text-[10px] text-indigo-400 font-bold tracking-widest uppercase">{user.username}</span>
          </div>
        </div>
        
        <nav className="flex-1 space-y-1.5">
          <button onClick={() => setActiveTab('inbox')} className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'inbox' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800'}`}>
            <Inbox size={20} /> <span className="font-medium">Inbound Feed</span>
          </button>
          <button onClick={() => setActiveTab('sources')} className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'sources' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800'}`}>
            <Link2 size={20} /> <span className="font-medium">Cloud Sources</span>
          </button>
          <button onClick={() => setActiveTab('accounts')} className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'accounts' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800'}`}>
            <UserCheck size={20} /> <span className="font-medium">Integrations</span>
          </button>
          <button onClick={() => setActiveTab('settings')} className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'settings' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800'}`}>
            <SettingsIcon size={20} /> <span className="font-medium">System Settings</span>
          </button>
        </nav>

        <button onClick={() => setUser(null)} className="w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-slate-500 hover:text-red-400 hover:bg-red-400/5 transition-all">
          <LogOut size={20} /> <span className="font-medium">Sign Out</span>
        </button>
      </aside>

      <main className="flex-1 overflow-y-auto relative">
        <header className="sticky top-0 z-10 glass px-10 py-5 flex justify-between items-center border-b border-slate-800/50">
          <h2 className="text-lg font-bold text-white capitalize">{activeTab}</h2>
          <div className="flex items-center gap-4">
            {isFetching && <Loader2 className="w-4 h-4 text-indigo-400 animate-spin" />}
            <button onClick={refreshData} className="text-[10px] font-bold text-indigo-400 bg-indigo-500/5 px-4 py-2 rounded-full border border-indigo-500/20">SYNC NOW</button>
          </div>
        </header>

        <div className="p-10 max-w-7xl mx-auto">
          {activeTab === 'inbox' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {articles.length === 0 && !isFetching && (
                <div className="col-span-full py-20 flex flex-col items-center opacity-50">
                  <Inbox size={48} className="mb-4" />
                  <p>Your feed is empty. Add sources to begin.</p>
                </div>
              )}
              {articles.map(article => (
                <div key={article.id} className="glass p-8 rounded-[32px] border border-slate-800/50 flex flex-col h-full animate-in fade-in slide-in-from-bottom-4">
                  <div className="flex justify-between items-center mb-6">
                    <span className="text-[10px] font-black text-indigo-400 uppercase bg-indigo-500/5 px-2 py-1 rounded-lg">{article.source}</span>
                  </div>
                  <p className="text-slate-300 text-sm leading-relaxed mb-8 flex-1 line-clamp-6">{article.originalText}</p>
                  <button onClick={() => handleApprove(article)} className="w-full py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-500 font-bold text-white transition-all flex items-center justify-center gap-2">
                    <Zap size={16} /> Process with AI
                  </button>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'sources' && (
            <div className="space-y-10">
              <div className="max-w-2xl">
                <h3 className="text-2xl font-bold text-white mb-2">Cloud Monitoring</h3>
                <p className="text-slate-500 text-sm mb-8">Add Telegram channels to monitor for fresh content.</p>
                
                <form onSubmit={handleAddSource} className="flex gap-3">
                  <div className="relative flex-1">
                    <Hash className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 w-5 h-5" />
                    <input 
                      type="text" 
                      placeholder="Telegram username (e.g. techcrunch)"
                      value={newSourceUrl}
                      onChange={e => setNewSourceUrl(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-2xl pl-12 pr-6 py-4 text-white focus:border-indigo-500 outline-none transition-all"
                    />
                  </div>
                  <button className="bg-indigo-600 hover:bg-indigo-500 px-8 rounded-2xl font-bold text-white flex items-center gap-2 transition-all shadow-lg shadow-indigo-600/20">
                    <Plus size={20} /> Add
                  </button>
                </form>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {sources.map(source => (
                  <div key={source.id} className="glass p-6 rounded-3xl border border-slate-800 group hover:border-indigo-500/30 transition-all">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-4">
                        <div className="bg-indigo-500/10 p-3 rounded-2xl text-indigo-400">
                          <Link2 size={20} />
                        </div>
                        <div>
                          <h4 className="font-bold text-white">{source.url}</h4>
                          <div className="flex items-center gap-1.5 text-[10px] text-emerald-500 font-bold uppercase mt-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                            Monitoring
                          </div>
                        </div>
                      </div>
                      <button 
                        onClick={() => handleDeleteSource(source.id)}
                        className="opacity-0 group-hover:opacity-100 p-2 text-slate-500 hover:text-red-400 transition-all"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'accounts' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center mb-8">
                <div>
                  <h3 className="text-2xl font-bold text-white">Target Integrations</h3>
                  <p className="text-slate-500 text-sm">Where your content will be automatically published</p>
                </div>
                <button 
                  onClick={() => setShowAddAccount(true)}
                  className="bg-indigo-600 hover:bg-indigo-500 px-6 py-3 rounded-2xl font-bold text-white flex items-center gap-2 transition-all shadow-lg shadow-indigo-600/20"
                >
                  <Plus size={20} /> Connect Platform
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {accounts.map(acc => (
                  <div key={acc.id} className="glass p-6 rounded-3xl border border-slate-800 flex flex-col">
                    <div className="flex justify-between items-start mb-4">
                      <div className="bg-slate-900 p-3 rounded-2xl text-indigo-400">
                        <Globe size={20} />
                      </div>
                      <button onClick={() => deleteAccount(acc.id)} className="text-slate-600 hover:text-red-400 transition-all p-2"><Trash2 size={16}/></button>
                    </div>
                    <h4 className="font-bold text-white text-lg">{acc.name || 'Unnamed Account'}</h4>
                    <p className="text-slate-500 text-xs mb-4 uppercase tracking-widest font-bold">{acc.platform}</p>
                    <div className="mt-auto flex items-center gap-2 text-emerald-500 text-[10px] font-bold uppercase">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                      Online & Ready
                    </div>
                  </div>
                ))}
              </div>

              {showAddAccount && (
                <div className="fixed inset-0 z-[100] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-6">
                  <div className="glass w-full max-w-md p-10 rounded-[40px] border border-white/5">
                    <h3 className="text-2xl font-bold text-white mb-8">Connect New Platform</h3>
                    <div className="space-y-4">
                      <select 
                        value={newAccPlatform}
                        onChange={e => setNewAccPlatform(e.target.value as Platform)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-2xl px-6 py-4 text-white outline-none"
                      >
                        {Object.values(Platform).map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                      <input 
                        placeholder="Friendly Name (e.g. My Telegram Channel)"
                        value={newAccName}
                        onChange={e => setNewAccName(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-2xl px-6 py-4 text-white outline-none"
                      />
                      {newAccPlatform === Platform.TELEGRAM && (
                        <>
                          <input 
                            placeholder="Bot Token (from @BotFather)"
                            value={newAccCreds.botToken}
                            onChange={e => setNewAccCreds({...newAccCreds, botToken: e.target.value})}
                            className="w-full bg-slate-900 border border-slate-800 rounded-2xl px-6 py-4 text-white outline-none"
                          />
                          <input 
                            placeholder="Chat/Channel ID (e.g. @mychannel)"
                            value={newAccCreds.chatId}
                            onChange={e => setNewAccCreds({...newAccCreds, chatId: e.target.value})}
                            className="w-full bg-slate-900 border border-slate-800 rounded-2xl px-6 py-4 text-white outline-none"
                          />
                        </>
                      )}
                      <div className="flex gap-4 mt-8">
                        <button onClick={() => setShowAddAccount(false)} className="flex-1 py-4 text-slate-400 font-bold hover:bg-white/5 rounded-2xl transition-all">Cancel</button>
                        <button onClick={handleAddAccount} className="flex-1 py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-2xl transition-all">Save Account</button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* AI Processing Modal */}
      {isProcessing && (
        <div className="fixed inset-0 z-[100] bg-slate-950/80 backdrop-blur-md flex flex-col items-center justify-center">
           <div className="relative">
              <div className="w-24 h-24 border-4 border-indigo-500/10 border-t-indigo-500 rounded-full animate-spin"></div>
              <Rocket className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-indigo-500" />
           </div>
           <p className="mt-8 text-indigo-400 font-bold tracking-widest text-sm">GEMINI AI IS ANALYZING CONTENT</p>
        </div>
      )}

      {/* Review Modal */}
      {selectedArticle && (
         <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-950/90 backdrop-blur-xl">
            <div className="glass w-full max-w-4xl max-h-[85vh] rounded-[40px] border border-white/5 overflow-hidden flex shadow-2xl animate-in slide-in-from-bottom-8 duration-500">
               <div className="flex-1 p-12 overflow-y-auto border-r border-slate-800">
                  <h3 className="text-2xl font-black mb-10 text-white">Review Generated Content</h3>
                  {selectedArticle.generatedImageUrl ? (
                    <img src={selectedArticle.generatedImageUrl} className="w-full h-64 object-cover rounded-3xl mb-8 border border-slate-800" />
                  ) : (
                    <div className="w-full h-48 bg-slate-900 rounded-3xl mb-8 flex flex-col items-center justify-center border border-dashed border-slate-800 text-slate-500">
                       <ImageIcon size={32} className="mb-2 opacity-20" />
                       <span className="text-xs uppercase tracking-widest font-bold">Image not generated</span>
                    </div>
                  )}
                  <div className="prose prose-invert bg-slate-900/50 p-8 rounded-3xl border border-slate-800 text-slate-300 leading-relaxed whitespace-pre-wrap">
                     {selectedArticle.rewrittenText}
                  </div>
               </div>
               <div className="w-80 p-10 bg-slate-950/50 flex flex-col">
                  <button onClick={() => setSelectedArticle(null)} className="self-end p-2 hover:bg-slate-800 rounded-full mb-10"><XCircle size={24} className="text-slate-500"/></button>
                  <div className="flex-1 space-y-4">
                     <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Active Destinations ({accounts.length})</p>
                     {accounts.map(acc => (
                        <div key={acc.id} className="flex items-center gap-3 p-3 rounded-xl bg-slate-900 border border-slate-800">
                           <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                           <span className="text-xs font-bold text-white">{acc.name}</span>
                        </div>
                     ))}
                     {accounts.length === 0 && <p className="text-xs text-red-400 italic">No accounts connected!</p>}
                  </div>
                  <button 
                    disabled={accounts.length === 0}
                    onClick={async () => {
                        await postToPlatforms(selectedArticle);
                        setSelectedArticle(null);
                        alert("Successfully published across all platforms!");
                    }}
                    className="w-full py-5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-600 rounded-2xl font-bold shadow-xl shadow-indigo-600/20 transition-all flex items-center justify-center gap-2 text-white"
                  >
                     <Send size={20} /> Deploy Post
                  </button>
               </div>
            </div>
         </div>
      )}
    </div>
  );
};

export default App;
