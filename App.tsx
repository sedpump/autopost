
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
  ImageIcon,
  AlertCircle,
  ExternalLink,
  Check,
  Layers,
  Sparkles,
  Info,
  HelpCircle,
  ShieldAlert,
  Key,
  Edit2,
  ShieldCheck,
  Bug,
  Instagram,
  ZapOff,
  Flame,
  Layout,
  Smartphone
} from 'lucide-react';
import { Platform, Article, PostingStatus, Source, Account, User, RewriteVariant } from './types';
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
  updateAccount,
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
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [newSourceUrl, setNewSourceUrl] = useState('');
  const [isFetching, setIsFetching] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDeploying, setIsDeploying] = useState(false);
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [editableText, setEditableText] = useState('');
  const [deployResults, setDeployResults] = useState<any[] | null>(null);
  const [hasImageKey, setHasImageKey] = useState<boolean>(true);
  
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [newAccPlatform, setNewAccPlatform] = useState<Platform>(Platform.TELEGRAM);
  const [newAccName, setNewAccName] = useState('');
  const [newAccCreds, setNewAccCreds] = useState<any>({});

  const [username, setUsername] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  useEffect(() => {
    const checkApiKey = async () => {
      if (typeof (window as any).aistudio !== 'undefined') {
        const hasKey = await (window as any).aistudio.hasSelectedApiKey();
        setHasImageKey(hasKey);
      }
    };
    checkApiKey();
  }, []);

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

  const handleOpenAiStudio = async () => {
    if (typeof (window as any).aistudio !== 'undefined') {
      await (window as any).aistudio.openSelectKey();
      const hasKey = await (window as any).aistudio.hasSelectedApiKey();
      setHasImageKey(hasKey);
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
      alert("Ошибка входа");
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
      alert("Не удалось добавить источник");
    }
  };

  const handleDeleteSource = async (id: string) => {
    if (!confirm("Вы уверены?")) return;
    try {
      await deleteSource(id);
      refreshData();
    } catch (e) {
      alert("Ошибка удаления");
    }
  };

  const openAddAccount = () => {
    setEditingAccount(null);
    setNewAccPlatform(Platform.TELEGRAM);
    setNewAccName('');
    setNewAccCreds({});
    setShowAddAccount(true);
  };

  const openEditAccount = (acc: Account) => {
    setEditingAccount(acc);
    setNewAccPlatform(acc.platform);
    setNewAccName(acc.name);
    setNewAccCreds(acc.credentials);
    setShowAddAccount(true);
  };

  const handleSaveAccount = async () => {
    // Автоматическая коррекция Chat ID для Telegram
    let finalCreds = { ...newAccCreds };
    if (newAccPlatform === Platform.TELEGRAM && finalCreds.chatId) {
      let cid = finalCreds.chatId.trim();
      // Если это не число и не начинается с @, добавляем @
      if (!cid.startsWith('@') && !cid.startsWith('-') && isNaN(Number(cid))) {
        finalCreds.chatId = `@${cid}`;
      }
    }

    try {
      if (editingAccount) {
        await updateAccount(editingAccount.id, {
          name: newAccName,
          credentials: finalCreds
        });
      } else {
        await addAccount({
          platform: newAccPlatform,
          name: newAccName,
          credentials: finalCreds
        });
      }
      setShowAddAccount(false);
      refreshData();
    } catch (e) {
      alert("Ошибка при сохранении аккаунта");
    }
  };

  const handleDeleteAccount = async (id: string) => {
    if (!confirm("Удалить эту интеграцию?")) return;
    try {
      await deleteAccount(id);
      refreshData();
    } catch (e) {
      alert("Ошибка удаления");
    }
  };

  const handleDebugPost = async () => {
    if (accounts.length === 0) {
      alert("Сначала подключите хотя бы один аккаунт");
      return;
    }
    // Тот самый мем из скрина
    const testImage = "https://raw.githubusercontent.com/otter-stuff/memes/main/ebat.jpg";
    const testArticle: Article = {
      id: 'debug_' + Date.now(),
      userId: user?.id || '',
      source: 'OmniPost Debug',
      originalText: 'Тестовая публикация с мемом',
      timestamp: new Date().toISOString(),
      status: 'approved',
      rewrittenText: `🚀 ТЕСТОВЫЙ ПОСТ (Debug Mode)\n\nВсе системы работают штатно. Картинка должна быть ниже.\n\nВремя: ${new Date().toLocaleTimeString()}`,
      generatedImageUrl: testImage
    };
    setIsDeploying(true);
    setEditableText(testArticle.rewrittenText || '');
    setSelectedArticle(testArticle); 
    try {
      const result = await postToPlatforms({ ...testArticle, rewrittenText: testArticle.rewrittenText });
      setDeployResults(result.results);
    } catch (e: any) {
      alert("Ошибка: " + e.message);
    } finally {
      setIsDeploying(false);
    }
  };

  const handleApprove = async (article: Article) => {
    if (!hasImageKey) await handleOpenAiStudio();
    setIsProcessing(true);
    try {
      const variants = await rewriteArticle(article.originalText);
      let imageUrl = '';
      try {
        const visualPromptData = await extractKeyConcepts(variants[0].content);
        if (visualPromptData.length > 0) imageUrl = await generateImageForArticle(visualPromptData[0]);
      } catch (imgError) {}
      
      const updatedArticle: Article = {
        ...article,
        status: 'approved',
        rewrittenVariants: variants,
        selectedVariantIndex: 0,
        rewrittenText: variants[0].content,
        generatedImageUrl: imageUrl || undefined,
      };
      setArticles(prev => prev.map(a => a.id === article.id ? updatedArticle : a));
      setEditableText(variants[0].content);
      setDeployResults(null);
      setSelectedArticle(updatedArticle);
    } catch (error: any) {
      alert("Ошибка ИИ: " + error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSelectVariant = (index: number) => {
    if (!selectedArticle || !selectedArticle.rewrittenVariants) return;
    const variant = selectedArticle.rewrittenVariants[index];
    setEditableText(variant.content);
    setSelectedArticle({
      ...selectedArticle,
      selectedVariantIndex: index,
      rewrittenText: variant.content
    });
  };

  const handleDeploy = async () => {
    if (!selectedArticle) return;
    setIsDeploying(true);
    try {
      const result = await postToPlatforms({ 
        ...selectedArticle, 
        rewrittenText: editableText 
      });
      setDeployResults(result.results);
    } catch (e: any) {
      alert("Ошибка: " + e.message);
    } finally {
      setIsDeploying(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
        <div className="max-w-md w-full glass p-10 rounded-[40px] border border-white/5 shadow-2xl text-center">
          <div className="bg-indigo-600 p-4 rounded-3xl mb-6 inline-block"><Lock className="text-white w-8 h-8" /></div>
          <h1 className="text-3xl font-black text-white mb-2">OmniPost AI</h1>
          <form onSubmit={handleLogin} className="space-y-4 mt-8 text-left">
            <input 
              type="text" placeholder="Имя пользователя" value={username}
              onChange={e => setUsername(e.target.value)}
              className="w-full bg-slate-900/50 border border-slate-800 rounded-2xl px-6 py-4 focus:border-indigo-500 outline-none text-white"
            />
            <button disabled={authLoading} className="w-full bg-indigo-600 hover:bg-indigo-500 py-4 rounded-2xl font-bold text-white transition-all flex items-center justify-center gap-2">
              {authLoading ? <Loader2 className="animate-spin" /> : "Войти"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  const renderAccountIcon = (platform: Platform) => {
    switch(platform) {
      case Platform.TELEGRAM: return <Send size={20} />;
      case Platform.VK: return <Globe size={20} />;
      case Platform.INSTAGRAM: return <Instagram size={20} />;
      case Platform.DZEN: return <Layout size={20} />;
      case Platform.TENCHAT: return <Smartphone size={20} />;
      case Platform.PIKABU: return <Flame size={20} />;
      default: return <Zap size={20} />;
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-slate-950 text-slate-200 font-inter">
      <aside className="w-72 glass border-r border-slate-800 flex flex-col p-6 space-y-8 z-20">
        <div className="flex items-center space-x-3 px-2">
          <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-2.5 rounded-2xl"><Radio className="w-6 h-6 text-white" /></div>
          <h1 className="text-xl font-black text-white">OmniPost</h1>
        </div>
        <nav className="flex-1 space-y-1.5">
          <button onClick={() => setActiveTab('inbox')} className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'inbox' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800'}`}>
            <Inbox size={20} /> <span className="font-medium">Входящие</span>
          </button>
          <button onClick={() => setActiveTab('sources')} className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'sources' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800'}`}>
            <Link2 size={20} /> <span className="font-medium">Источники</span>
          </button>
          <button onClick={() => setActiveTab('accounts')} className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'accounts' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800'}`}>
            <UserCheck size={20} /> <span className="font-medium">Аккаунты</span>
          </button>
          <button onClick={() => setActiveTab('settings')} className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'settings' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800'}`}>
            <SettingsIcon size={20} /> <span className="font-medium">Настройки</span>
          </button>
        </nav>
        <button onClick={() => setUser(null)} className="w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-slate-500 hover:text-red-400 hover:bg-red-400/5 transition-all">
          <LogOut size={20} /> <span className="font-medium">Выйти</span>
        </button>
      </aside>

      <main className="flex-1 overflow-y-auto relative bg-slate-950/50">
        <header className="sticky top-0 z-10 glass px-10 py-5 flex justify-between items-center border-b border-slate-800/50">
          <h2 className="text-lg font-bold text-white capitalize">{activeTab}</h2>
          <button onClick={refreshData} className="text-[10px] font-bold text-indigo-400 bg-indigo-500/5 px-4 py-2 rounded-full border border-indigo-500/20 uppercase">Обновить</button>
        </header>

        <div className="p-10 max-w-7xl mx-auto">
          {activeTab === 'inbox' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {articles.map(article => (
                <div key={article.id} className="glass p-8 rounded-[32px] border border-slate-800/50 flex flex-col h-full hover:border-indigo-500/30 transition-all">
                  <div className="flex justify-between items-center mb-6 text-[10px] font-bold text-indigo-400">
                    <span className="uppercase">{article.source}</span>
                    <span className="text-slate-600">{article.timestamp}</span>
                  </div>
                  <p className="text-slate-300 text-sm leading-relaxed mb-8 flex-1 line-clamp-6">{article.originalText}</p>
                  <button onClick={() => handleApprove(article)} className="w-full py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-500 font-bold text-white transition-all flex items-center justify-center gap-2">
                    <Sparkles size={16} /> Обработать Gemini
                  </button>
                </div>
              ))}
              {articles.length === 0 && !isFetching && (
                <div className="col-span-full py-20 text-center text-slate-500">
                   <div className="mb-4 inline-block p-4 bg-slate-900 rounded-full"><Info size={32}/></div>
                   <p>Входящих публикаций нет. Добавьте источники Telegram.</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'accounts' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-2xl font-bold text-white">Каналы публикации</h3>
                <div className="flex gap-3">
                  <button onClick={handleDebugPost} className="bg-slate-800 hover:bg-slate-700 px-6 py-3 rounded-2xl font-bold text-indigo-400 border border-indigo-500/20 flex items-center gap-2 transition-all">
                    <Bug size={18} /> Отладка
                  </button>
                  <button onClick={openAddAccount} className="bg-indigo-600 hover:bg-indigo-500 px-6 py-3 rounded-2xl font-bold text-white flex items-center gap-2 transition-all">
                    <Plus size={20} /> Добавить канал
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {accounts.map(acc => (
                  <div key={acc.id} className="glass p-6 rounded-3xl border border-slate-800 flex flex-col group hover:border-indigo-500/30 transition-all">
                    <div className="flex justify-between mb-4">
                      <div className="bg-slate-900 p-3 rounded-2xl text-indigo-400">{renderAccountIcon(acc.platform)}</div>
                      <div className="flex gap-1">
                        <button onClick={() => openEditAccount(acc)} className="text-slate-600 hover:text-indigo-400 p-2"><Edit2 size={16}/></button>
                        <button onClick={() => handleDeleteAccount(acc.id)} className="text-slate-600 hover:text-red-400 p-2"><Trash2 size={16}/></button>
                      </div>
                    </div>
                    <h4 className="font-bold text-white text-lg">{acc.name}</h4>
                    <p className="text-slate-500 text-xs uppercase font-black">{acc.platform}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'sources' && (
             <div className="max-w-2xl space-y-6">
                <div className="glass p-8 rounded-[40px] border border-slate-800">
                  <h3 className="text-xl font-bold text-white mb-6">Новый источник (Telegram)</h3>
                  <form onSubmit={handleAddSource} className="flex gap-4">
                    <input type="text" placeholder="@channel_name" value={newSourceUrl} onChange={e => setNewSourceUrl(e.target.value)} className="flex-1 bg-slate-900 border border-slate-800 rounded-2xl px-6 py-4 text-white outline-none" />
                    <button className="bg-indigo-600 px-8 rounded-2xl font-bold text-white"><Plus /></button>
                  </form>
                </div>
                <div className="space-y-3">
                  {sources.map(s => (
                    <div key={s.id} className="glass p-6 rounded-3xl border border-slate-800 flex items-center justify-between">
                      <div className="flex items-center gap-4 text-indigo-400"><Hash size={20} /> <span className="font-bold text-white">{s.url}</span></div>
                      <button onClick={() => handleDeleteSource(s.id)} className="text-slate-600 hover:text-red-400"><Trash2 size={20}/></button>
                    </div>
                  ))}
                </div>
             </div>
          )}

          {activeTab === 'settings' && (
            <div className="max-w-xl glass p-10 rounded-[40px] border border-slate-800">
               <h3 className="text-2xl font-bold text-white mb-8">Настройки системы</h3>
               <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-bold">Ключ Gemini 3 Pro</h4>
                      <p className="text-xs text-slate-500">Для генерации картинок</p>
                    </div>
                    <button onClick={handleOpenAiStudio} className="bg-indigo-600/10 text-indigo-400 px-4 py-2 rounded-xl border border-indigo-500/20 font-bold text-xs uppercase">
                      {hasImageKey ? "Обновить" : "Привязать"}
                    </button>
                  </div>
               </div>
            </div>
          )}
        </div>
      </main>

      {showAddAccount && (
        <div className="fixed inset-0 z-[100] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-6">
          <div className="glass w-full max-w-xl p-10 rounded-[40px] border border-white/5 animate-in zoom-in duration-300">
            <h3 className="text-2xl font-bold text-white mb-2">{editingAccount ? 'Редактировать' : 'Добавить'} канал</h3>
            <p className="text-slate-500 text-sm mb-8">Выберите платформу и укажите данные доступа</p>
            
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-2 mb-4">
                 {Object.values(Platform).map(p => (
                   <button key={p} onClick={() => setNewAccPlatform(p)} className={`py-3 rounded-2xl border font-bold text-[10px] flex flex-col items-center justify-center gap-1 transition-all ${newAccPlatform === p ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg' : 'bg-slate-900 border-slate-800 text-slate-500'}`}>
                     {renderAccountIcon(p)} {p}
                   </button>
                 ))}
              </div>

              <input placeholder="Название для себя (напр. 'Мой паблик ВК')" value={newAccName} onChange={e => setNewAccName(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-2xl px-6 py-4 text-white outline-none" />

              {newAccPlatform === Platform.TELEGRAM && (
                <div className="space-y-3">
                  <input placeholder="Bot Token (от @BotFather)" value={newAccCreds.botToken || ''} onChange={e => setNewAccCreds({...newAccCreds, botToken: e.target.value})} className="w-full bg-slate-900 border border-slate-800 rounded-2xl px-6 py-4 text-white outline-none text-sm" />
                  <input placeholder="Chat ID (напр. @my_channel или -100...)" value={newAccCreds.chatId || ''} onChange={e => setNewAccCreds({...newAccCreds, chatId: e.target.value})} className="w-full bg-slate-900 border border-slate-800 rounded-2xl px-6 py-4 text-white outline-none text-sm" />
                </div>
              )}

              {newAccPlatform === Platform.VK && (
                <div className="space-y-3">
                  <div className="p-4 bg-indigo-500/5 border border-indigo-500/10 rounded-2xl text-[11px] text-slate-400 mb-2">
                    <Info size={14} className="inline mr-2 text-indigo-400" />
                    Ключ берите во вкладке <b>Ключи доступа</b>.
                  </div>
                  <input placeholder="Access Token (Ключ доступа)" value={newAccCreds.accessToken || ''} onChange={e => setNewAccCreds({...newAccCreds, accessToken: e.target.value})} className="w-full bg-slate-900 border border-slate-800 rounded-2xl px-6 py-4 text-white outline-none text-sm" />
                  <input placeholder="ID группы (с минусом, напр. -223967249)" value={newAccCreds.ownerId || ''} onChange={e => setNewAccCreds({...newAccCreds, ownerId: e.target.value})} className="w-full bg-slate-900 border border-slate-800 rounded-2xl px-6 py-4 text-white outline-none text-sm" />
                </div>
              )}

              {newAccPlatform === Platform.DZEN && (
                <div className="space-y-3">
                  <input placeholder="Dzen API Token" value={newAccCreds.token || ''} onChange={e => setNewAccCreds({...newAccCreds, token: e.target.value})} className="w-full bg-slate-900 border border-slate-800 rounded-2xl px-6 py-4 text-white outline-none text-sm" />
                </div>
              )}

              {newAccPlatform === Platform.INSTAGRAM && (
                <div className="space-y-3">
                  <input placeholder="FB Graph Access Token" value={newAccCreds.accessToken || ''} onChange={e => setNewAccCreds({...newAccCreds, accessToken: e.target.value})} className="w-full bg-slate-900 border border-slate-800 rounded-2xl px-6 py-4 text-white outline-none text-sm" />
                  <input placeholder="Instagram Business Account ID" value={newAccCreds.igId || ''} onChange={e => setNewAccCreds({...newAccCreds, igId: e.target.value})} className="w-full bg-slate-900 border border-slate-800 rounded-2xl px-6 py-4 text-white outline-none text-sm" />
                </div>
              )}

              <div className="flex gap-4 mt-8">
                <button onClick={() => setShowAddAccount(false)} className="flex-1 py-4 text-slate-400 font-bold hover:bg-white/5 rounded-2xl transition-all">Отмена</button>
                <button onClick={handleSaveAccount} className="flex-1 py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-2xl transition-all shadow-lg shadow-indigo-600/20">Сохранить</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {(isProcessing || isDeploying) && (
        <div className="fixed inset-0 z-[110] bg-slate-950/80 backdrop-blur-md flex flex-col items-center justify-center">
           <div className="w-20 h-20 border-4 border-indigo-500/10 border-t-indigo-500 rounded-full animate-spin mb-6"></div>
           <p className="text-white text-xl font-black">{isDeploying ? 'Публикация контента...' : 'Нейросети обрабатывают контент...'}</p>
        </div>
      )}

      {selectedArticle && !isDeploying && (
         <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-950/90 backdrop-blur-xl">
            <div className="glass w-full max-w-7xl max-h-[95vh] rounded-[48px] border border-white/5 overflow-hidden flex shadow-2xl animate-in slide-in-from-bottom-12">
               <div className="flex-1 p-14 overflow-y-auto border-r border-slate-800/50 flex flex-col">
                  <div className="flex justify-between items-center mb-12">
                    <h3 className="text-3xl font-black text-white">Студия контента</h3>
                    <div className="flex gap-2">
                       <button onClick={() => handleApprove(selectedArticle)} className="p-3 bg-indigo-500/10 text-indigo-400 rounded-2xl hover:bg-indigo-500/20 transition-all" title="Перегенерировать">
                         <Sparkles size={20}/>
                       </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
                     <div className="lg:col-span-5 space-y-5">
                        <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest px-2">Варианты от ИИ</label>
                        {selectedArticle.rewrittenVariants?.map((variant, idx) => (
                           <button key={idx} onClick={() => handleSelectVariant(idx)} className={`w-full p-6 rounded-3xl border text-left transition-all ${selectedArticle.selectedVariantIndex === idx ? 'bg-indigo-600/10 border-indigo-500' : 'bg-slate-900/40 border-slate-800 hover:border-slate-700'}`}>
                              <h4 className="font-black text-[11px] uppercase text-indigo-400 mb-2">{variant.title}</h4>
                              <p className="text-sm text-slate-300 line-clamp-3">{variant.content}</p>
                           </button>
                        ))}
                     </div>
                     <div className="lg:col-span-7 space-y-8">
                        {selectedArticle.generatedImageUrl && (
                          <div className="relative group">
                            <img src={selectedArticle.generatedImageUrl} className="w-full rounded-[40px] border border-slate-800 shadow-2xl" />
                            <div className="absolute inset-0 bg-indigo-600/0 group-hover:bg-indigo-600/10 transition-all rounded-[40px] pointer-events-none"></div>
                          </div>
                        )}
                        <div className="space-y-3">
                           <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest px-2">Финальный текст (можно редактировать)</label>
                           <textarea 
                              value={editableText}
                              onChange={(e) => setEditableText(e.target.value)}
                              className="w-full min-h-[250px] p-10 bg-slate-900/50 rounded-[40px] border border-slate-800 text-base text-slate-100 font-medium whitespace-pre-wrap outline-none focus:border-indigo-500/50 transition-all resize-none"
                           />
                        </div>
                     </div>
                  </div>
               </div>
               <div className="w-[400px] p-12 bg-slate-950/60 backdrop-blur-md flex flex-col">
                  <button onClick={() => { setSelectedArticle(null); setDeployResults(null); }} className="self-end mb-12"><XCircle size={28} className="text-slate-600 hover:text-white"/></button>
                  <div className="flex-1 space-y-4">
                     <h5 className="text-[10px] font-black uppercase text-slate-500 mb-4 px-2">Выбранные каналы</h5>
                     {deployResults ? deployResults.map((res: any, idx: number) => (
                        <div key={idx} className={`p-5 rounded-3xl border flex flex-col gap-1 ${res.status === 'success' ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-red-500/5 border-red-500/20'}`}>
                           <div className="flex justify-between items-center">
                             <p className="text-sm font-black text-white">{res.name}</p>
                             {res.status === 'success' ? <Check size={16} className="text-emerald-500"/> : <AlertCircle size={16} className="text-red-500"/>}
                           </div>
                           <p className={`text-[10px] uppercase font-black ${res.status === 'success' ? 'text-emerald-500' : 'text-red-500'}`}>{res.status === 'success' ? 'Успешно' : 'Ошибка'}</p>
                           {res.error && <p className="text-[10px] text-red-300/60 mt-2 line-clamp-3 bg-red-950/20 p-2 rounded-xl">{res.error}</p>}
                        </div>
                     )) : accounts.map(acc => (
                        <div key={acc.id} className="p-5 rounded-3xl bg-slate-900/50 border border-slate-800/50 flex items-center justify-between hover:bg-slate-900 transition-all">
                           <span className="text-sm font-bold text-white">{acc.name}</span>
                           <div className="text-slate-700">{renderAccountIcon(acc.platform)}</div>
                        </div>
                     ))}
                  </div>
                  {!deployResults ? (
                    <button onClick={handleDeploy} className="w-full mt-8 py-6 bg-indigo-600 hover:bg-indigo-500 rounded-[32px] font-black text-white uppercase tracking-widest text-xs shadow-xl shadow-indigo-600/30 transition-all active:scale-95">Опубликовать во всех</button>
                  ) : (
                    <button onClick={() => { setSelectedArticle(null); setDeployResults(null); refreshData(); }} className="w-full mt-8 py-6 bg-slate-800 hover:bg-slate-700 text-white rounded-[32px] font-black uppercase text-xs transition-all">Готово</button>
                  )}
               </div>
            </div>
         </div>
      )}
    </div>
  );
};

export default App;
