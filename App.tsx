
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
  Image as ImageIcon,
  AlertCircle,
  ExternalLink,
  Check,
  Layers,
  Sparkles,
  Info,
  HelpCircle,
  ShieldAlert,
  Key
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
  const [deployResults, setDeployResults] = useState<any[] | null>(null);
  const [hasImageKey, setHasImageKey] = useState<boolean>(true);
  
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [newAccPlatform, setNewAccPlatform] = useState<Platform>(Platform.TELEGRAM);
  const [newAccName, setNewAccName] = useState('');
  const [newAccCreds, setNewAccCreds] = useState({ botToken: '', chatId: '', accessToken: '', ownerId: '' });

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
      setHasImageKey(true);
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

  const handleAddAccount = async () => {
    try {
      const creds: any = {};
      if (newAccPlatform === Platform.TELEGRAM) {
        let cleanChatId = newAccCreds.chatId.trim();
        if (!cleanChatId.startsWith('@') && !cleanChatId.startsWith('-') && isNaN(Number(cleanChatId))) {
          cleanChatId = `@${cleanChatId}`;
        }
        creds.botToken = newAccCreds.botToken.trim();
        creds.chatId = cleanChatId;
      } else if (newAccPlatform === Platform.VK) {
        creds.accessToken = newAccCreds.accessToken.trim();
        creds.ownerId = newAccCreds.ownerId.trim();
      }

      await addAccount({
        platform: newAccPlatform,
        name: newAccName,
        credentials: creds
      });
      setShowAddAccount(false);
      refreshData();
    } catch (e) {
      alert("Ошибка при добавлении аккаунта");
    }
  };

  const handleApprove = async (article: Article) => {
    if (!hasImageKey) {
      await handleOpenAiStudio();
    }
    
    setIsProcessing(true);
    try {
      const variants = await rewriteArticle(article.originalText);
      // Используем первый вариант для генерации картинки (он обычно самый качественный)
      let imageUrl = '';
      try {
        const visualPromptData = await extractKeyConcepts(variants[0].content);
        if (visualPromptData.length > 0) {
          imageUrl = await generateImageForArticle(visualPromptData[0]);
        }
      } catch (imgError) {
        console.warn("Ошибка генерации изображения", imgError);
      }
      
      const updatedArticle: Article = {
        ...article,
        status: 'approved',
        rewrittenVariants: variants,
        selectedVariantIndex: 0,
        rewrittenText: variants[0].content,
        generatedImageUrl: imageUrl || undefined,
      };

      setArticles(prev => prev.map(a => a.id === article.id ? updatedArticle : a));
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
    setSelectedArticle({
      ...selectedArticle,
      selectedVariantIndex: index,
      rewrittenText: selectedArticle.rewrittenVariants[index].content
    });
  };

  const handleDeploy = async () => {
    if (!selectedArticle) return;
    setIsDeploying(true);
    try {
      const result = await postToPlatforms(selectedArticle);
      setDeployResults(result.results);
    } catch (e: any) {
      alert("Ошибка публикации: " + e.message);
    } finally {
      setIsDeploying(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
        <div className="max-w-md w-full glass p-10 rounded-[40px] border border-white/5 shadow-2xl">
          <div className="flex flex-col items-center mb-10">
            <div className="bg-indigo-600 p-4 rounded-3xl mb-6 shadow-lg shadow-indigo-600/30">
              <Lock className="text-white w-8 h-8" />
            </div>
            <h1 className="text-3xl font-black text-white mb-2">OmniPost AI</h1>
            <p className="text-slate-400 text-center">Система автоматического постинга</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <input 
              type="text" 
              placeholder="Имя пользователя" 
              value={username}
              onChange={e => setUsername(e.target.value)}
              className="w-full bg-slate-900/50 border border-slate-800 rounded-2xl px-6 py-4 focus:border-indigo-500 outline-none text-white"
            />
            <button 
              disabled={authLoading}
              className="w-full bg-indigo-600 hover:bg-indigo-500 py-4 rounded-2xl font-bold text-white transition-all flex items-center justify-center gap-2"
            >
              {authLoading ? <Loader2 className="animate-spin" /> : "Войти"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-950 text-slate-200 font-inter">
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

        {!hasImageKey && (activeTab === 'inbox') && (
          <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl">
             <div className="flex items-center gap-2 mb-2">
                <AlertCircle size={14} className="text-amber-500" />
                <p className="text-[10px] text-amber-500 font-bold uppercase">Нужен платный ключ</p>
             </div>
             <p className="text-[9px] text-slate-500 mb-3 leading-tight">Для генерации Gemini 3 Pro Image требуется проект с биллингом.</p>
             <button onClick={handleOpenAiStudio} className="w-full py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-500 text-[10px] font-black rounded-lg transition-all">ВЫБРАТЬ КЛЮЧ</button>
          </div>
        )}

        <button onClick={() => setUser(null)} className="w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-slate-500 hover:text-red-400 hover:bg-red-400/5 transition-all">
          <LogOut size={20} /> <span className="font-medium">Выйти</span>
        </button>
      </aside>

      <main className="flex-1 overflow-y-auto relative bg-slate-950/50">
        <header className="sticky top-0 z-10 glass px-10 py-5 flex justify-between items-center border-b border-slate-800/50">
          <div className="flex items-center gap-3">
             <h2 className="text-lg font-bold text-white capitalize">
               {activeTab === 'inbox' ? 'Лента контента' : activeTab === 'sources' ? 'Источники данных' : activeTab === 'accounts' ? 'Интеграции' : 'Настройки'}
             </h2>
             {activeTab === 'inbox' && articles.length > 0 && <span className="bg-indigo-500/20 text-indigo-400 text-[10px] font-bold px-2 py-0.5 rounded-full border border-indigo-500/30">Новых: {articles.length}</span>}
          </div>
          <div className="flex items-center gap-4">
            {isFetching && <Loader2 className="w-4 h-4 text-indigo-400 animate-spin" />}
            <button onClick={refreshData} className="text-[10px] font-bold text-indigo-400 bg-indigo-500/5 px-4 py-2 rounded-full border border-indigo-500/20 tracking-widest hover:bg-indigo-500/10 transition-all uppercase">Обновить ленту</button>
          </div>
        </header>

        <div className="p-10 max-w-7xl mx-auto">
          {activeTab === 'inbox' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {articles.length === 0 && !isFetching && (
                <div className="col-span-full py-20 flex flex-col items-center opacity-50">
                  <Inbox size={48} className="mb-4 text-slate-700" />
                  <p className="text-slate-500">Лента пуста. Добавьте Telegram-каналы во вкладке "Источники".</p>
                </div>
              )}
              {articles.map(article => (
                <div key={article.id} className="glass p-8 rounded-[32px] border border-slate-800/50 flex flex-col h-full animate-in fade-in slide-in-from-bottom-4 transition-all hover:border-indigo-500/30 group">
                  <div className="flex justify-between items-center mb-6">
                    <span className="text-[10px] font-black text-indigo-400 uppercase bg-indigo-500/5 px-2 py-1 rounded-lg border border-indigo-500/10">{article.source}</span>
                    <span className="text-[10px] text-slate-600 font-bold">{article.timestamp}</span>
                  </div>
                  <p className="text-slate-300 text-sm leading-relaxed mb-8 flex-1 line-clamp-6 group-hover:line-clamp-none transition-all duration-500">{article.originalText}</p>
                  <button onClick={() => handleApprove(article)} className="w-full py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-500 font-bold text-white transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/10">
                    <Sparkles size={16} /> Обработать через Gemini 3 Pro
                  </button>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'sources' && (
            <div className="space-y-10">
              <div className="max-w-2xl">
                <h3 className="text-2xl font-bold text-white mb-2">Облачный мониторинг</h3>
                <p className="text-slate-500 text-sm mb-8">Добавьте Telegram-каналы для автоматического сбора контента.</p>
                
                <form onSubmit={handleAddSource} className="flex gap-3">
                  <div className="relative flex-1">
                    <Hash className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 w-5 h-5" />
                    <input 
                      type="text" 
                      placeholder="Username канала (напр. techcrunch)"
                      value={newSourceUrl}
                      onChange={e => setNewSourceUrl(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-2xl pl-12 pr-6 py-4 text-white focus:border-indigo-500 outline-none transition-all"
                    />
                  </div>
                  <button className="bg-indigo-600 hover:bg-indigo-500 px-8 rounded-2xl font-bold text-white flex items-center gap-2 transition-all shadow-lg shadow-indigo-600/20">
                    <Plus size={20} /> Добавить
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
                            Мониторинг активен
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
                  <h3 className="text-2xl font-bold text-white">Каналы публикации</h3>
                  <p className="text-slate-500 text-sm">Настройте свои площадки для автоматического постинга.</p>
                </div>
                <button 
                  onClick={() => setShowAddAccount(true)}
                  className="bg-indigo-600 hover:bg-indigo-500 px-6 py-3 rounded-2xl font-bold text-white flex items-center gap-2 transition-all shadow-lg shadow-indigo-600/20"
                >
                  <Plus size={20} /> Новая интеграция
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {accounts.map(acc => (
                  <div key={acc.id} className="glass p-6 rounded-3xl border border-slate-800 flex flex-col group hover:border-indigo-500/30 transition-all">
                    <div className="flex justify-between items-start mb-4">
                      <div className="bg-slate-900 p-3 rounded-2xl text-indigo-400 group-hover:text-white group-hover:bg-indigo-600 transition-all">
                        <Globe size={20} />
                      </div>
                      <button onClick={() => deleteAccount(acc.id)} className="text-slate-600 hover:text-red-400 transition-all p-2"><Trash2 size={16}/></button>
                    </div>
                    <h4 className="font-bold text-white text-lg">{acc.name || 'Аккаунт'}</h4>
                    <p className="text-slate-500 text-xs mb-4 uppercase tracking-widest font-black">{acc.platform}</p>
                    <div className="mt-auto flex items-center gap-2 text-emerald-500 text-[10px] font-black uppercase">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                      Подключено
                    </div>
                  </div>
                ))}
              </div>

              {showAddAccount && (
                <div className="fixed inset-0 z-[100] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-6">
                  <div className="glass w-full max-w-md p-10 rounded-[40px] border border-white/5 shadow-2xl animate-in zoom-in duration-300">
                    <h3 className="text-2xl font-bold text-white mb-8">Подключить платформу</h3>
                    <div className="space-y-4">
                      <div className="space-y-1">
                         <p className="text-[10px] font-black text-slate-500 uppercase px-2 mb-1">Выберите сеть</p>
                         <select 
                            value={newAccPlatform}
                            onChange={e => setNewAccPlatform(e.target.value as Platform)}
                            className="w-full bg-slate-900 border border-slate-800 rounded-2xl px-6 py-4 text-white outline-none focus:border-indigo-500 appearance-none"
                          >
                            {Object.values(Platform).map(p => <option key={p} value={p}>{p}</option>)}
                          </select>
                      </div>
                      <input 
                        placeholder="Название (напр. Личный блог)"
                        value={newAccName}
                        onChange={e => setNewAccName(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-2xl px-6 py-4 text-white outline-none focus:border-indigo-500"
                      />
                      
                      {newAccPlatform === Platform.TELEGRAM && (
                        <>
                          <input 
                            placeholder="Bot Token (от @BotFather)"
                            value={newAccCreds.botToken}
                            onChange={e => setNewAccCreds({...newAccCreds, botToken: e.target.value})}
                            className="w-full bg-slate-900 border border-slate-800 rounded-2xl px-6 py-4 text-white outline-none focus:border-indigo-500"
                          />
                          <input 
                            placeholder="Chat ID (напр. @mychannel)"
                            value={newAccCreds.chatId}
                            onChange={e => setNewAccCreds({...newAccCreds, chatId: e.target.value})}
                            className="w-full bg-slate-900 border border-slate-800 rounded-2xl px-6 py-4 text-white outline-none focus:border-indigo-500"
                          />
                        </>
                      )}

                      {newAccPlatform === Platform.VK && (
                        <>
                          <div className="space-y-2">
                             <input 
                               placeholder="VK Access Token"
                               value={newAccCreds.accessToken}
                               onChange={e => setNewAccCreds({...newAccCreds, accessToken: e.target.value})}
                               className="w-full bg-slate-900 border border-slate-800 rounded-2xl px-6 py-4 text-white outline-none focus:border-indigo-500"
                             />
                             <a 
                                href="https://vkhost.github.io/" 
                                target="_blank" 
                                className="flex items-center gap-1.5 text-[10px] text-indigo-400 font-black uppercase hover:underline px-2"
                             >
                                <Key size={12} /> Получить токен (выбирайте Kate Mobile)
                             </a>
                          </div>

                          <div className="space-y-2">
                             <input 
                               placeholder="Цифровой Owner ID (напр. -12345678)"
                               value={newAccCreds.ownerId}
                               onChange={e => setNewAccCreds({...newAccCreds, ownerId: e.target.value})}
                               className="w-full bg-slate-900 border border-slate-800 rounded-2xl px-6 py-4 text-white outline-none focus:border-indigo-500"
                             />
                             <div className="flex flex-col gap-2 p-4 bg-indigo-500/5 rounded-2xl border border-indigo-500/10">
                                <div className="flex items-start gap-2">
                                   <ShieldAlert size={14} className="text-amber-500 mt-0.5 flex-shrink-0" />
                                   <div className="text-[10px] text-slate-400 leading-tight">
                                      Если вы получили ошибку <b>Код 5</b> — ваш токен невалиден или просрочен.
                                      <br/><br/>
                                      Нужен <b>Токен пользователя</b> ( Kate Mobile подходит лучше всего). Убедитесь, что разрешены <b>wall</b> и <b>offline</b>.
                                   </div>
                                </div>
                             </div>
                          </div>
                        </>
                      )}

                      <div className="flex gap-4 mt-8">
                        <button onClick={() => setShowAddAccount(false)} className="flex-1 py-4 text-slate-400 font-bold hover:bg-white/5 rounded-2xl transition-all">Отмена</button>
                        <button onClick={handleAddAccount} className="flex-1 py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-2xl transition-all shadow-lg shadow-indigo-600/20">Сохранить</button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Global AI Overlay */}
      {(isProcessing || isDeploying) && (
        <div className="fixed inset-0 z-[100] bg-slate-950/80 backdrop-blur-md flex flex-col items-center justify-center animate-in fade-in duration-300">
           <div className="relative mb-10">
              <div className="w-28 h-28 border-4 border-indigo-500/10 border-t-indigo-500 rounded-full animate-spin"></div>
              {isDeploying ? <Rocket className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-indigo-400 w-8 h-8" /> : <Sparkles className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-indigo-400 w-8 h-8 animate-pulse" />}
           </div>
           <div className="text-center space-y-2">
              <p className="text-white text-xl font-black tracking-tight">
                {isDeploying ? "Публикация контента" : "Gemini 3 Pro анализирует контент"}
              </p>
              <p className="text-indigo-400 font-bold tracking-widest text-[10px] uppercase">
                {isDeploying ? "Синхронизация с облачными целями..." : "Создаем варианты и графику 1K..."}
              </p>
           </div>
        </div>
      )}

      {/* Enhanced Selection & Preview Modal */}
      {selectedArticle && !isDeploying && (
         <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-950/90 backdrop-blur-xl">
            <div className="glass w-full max-w-7xl max-h-[95vh] rounded-[48px] border border-white/5 overflow-hidden flex shadow-2xl animate-in slide-in-from-bottom-12 duration-700">
               
               {/* Left Content Area */}
               <div className="flex-1 p-14 overflow-y-auto border-r border-slate-800/50 flex flex-col bg-slate-900/20">
                  <div className="flex justify-between items-center mb-12">
                    <div className="space-y-1">
                       <h3 className="text-3xl font-black text-white tracking-tight">Студия контента</h3>
                       <p className="text-slate-500 text-sm font-medium">Выберите лучший стиль для вашей аудитории.</p>
                    </div>
                    <div className="flex items-center gap-2.5 px-4 py-2 bg-indigo-500/5 border border-indigo-500/20 rounded-2xl text-indigo-400 text-xs font-black uppercase tracking-widest">
                      <Sparkles size={14} className="animate-pulse" /> Движок Gemini 3 Pro
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
                     {/* Variants List */}
                     <div className="lg:col-span-5 space-y-5">
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                           <Layers size={14} /> Варианты от ИИ
                        </p>
                        {selectedArticle.rewrittenVariants?.map((variant, idx) => (
                           <button 
                             key={idx}
                             onClick={() => handleSelectVariant(idx)}
                             className={`w-full p-6 rounded-3xl border text-left transition-all relative group overflow-hidden ${selectedArticle.selectedVariantIndex === idx ? 'bg-indigo-600/10 border-indigo-500 ring-1 ring-indigo-500 shadow-2xl shadow-indigo-600/10' : 'bg-slate-900/40 border-slate-800 hover:border-slate-700'}`}
                           >
                              <div className="flex justify-between items-start mb-2">
                                 <h4 className={`font-black text-[11px] uppercase tracking-wider ${selectedArticle.selectedVariantIndex === idx ? 'text-indigo-300' : 'text-slate-500'}`}>{variant.title}</h4>
                                 {selectedArticle.selectedVariantIndex === idx && <Check size={18} className="text-indigo-400" />}
                              </div>
                              <p className={`text-sm leading-relaxed ${selectedArticle.selectedVariantIndex === idx ? 'text-white' : 'text-slate-400'} line-clamp-3 group-hover:line-clamp-none transition-all`}>
                                 {variant.content}
                              </p>
                              {selectedArticle.selectedVariantIndex === idx && <div className="absolute top-0 right-0 w-20 h-20 bg-indigo-500/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl"></div>}
                           </button>
                        ))}
                     </div>

                     {/* Visual Preview */}
                     <div className="lg:col-span-7 space-y-8">
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                           <ImageIcon size={14} /> Графика 1K
                        </p>
                        <div className="relative group rounded-[40px] overflow-hidden border border-slate-800 shadow-2xl shadow-black/40">
                          {selectedArticle.generatedImageUrl ? (
                            <>
                              <img src={selectedArticle.generatedImageUrl} className="w-full h-auto aspect-video object-cover transition-transform duration-1000 group-hover:scale-105" />
                              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-8">
                                 <p className="text-white/80 text-[10px] font-bold uppercase tracking-widest">Модель: Gemini 3 Pro Image (1024x1024)</p>
                              </div>
                            </>
                          ) : (
                            <div className="w-full aspect-video bg-slate-900 flex flex-col items-center justify-center text-slate-600">
                               <ImageIcon size={48} className="mb-4 opacity-10" />
                               <span className="text-xs uppercase tracking-widest font-black">Графика не создана</span>
                            </div>
                          )}
                        </div>
                        
                        <div className="p-10 bg-indigo-600/5 border border-indigo-500/10 rounded-[40px] relative overflow-hidden">
                           <div className="absolute top-0 right-0 p-4 opacity-10"><Sparkles size={40} /></div>
                           <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                              <ExternalLink size={12} /> Предпросмотр текста
                           </p>
                           <p className="text-base text-slate-100 leading-relaxed font-medium whitespace-pre-wrap">
                              {selectedArticle.rewrittenText}
                           </p>
                        </div>
                     </div>
                  </div>
               </div>
               
               {/* Right Sidebar Control */}
               <div className="w-[400px] p-12 bg-slate-950/60 backdrop-blur-md flex flex-col">
                  <button onClick={() => { setSelectedArticle(null); setDeployResults(null); }} className="self-end p-3 hover:bg-slate-800 rounded-2xl mb-12 transition-all"><XCircle size={28} className="text-slate-600 hover:text-white"/></button>
                  
                  <div className="flex-1 flex flex-col">
                     <div className="mb-8">
                        <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-6">Каналы рассылки</p>
                        
                        {deployResults ? (
                           <div className="space-y-4">
                              {deployResults.map((res: any, idx: number) => (
                                 <div key={idx} className={`p-5 rounded-3xl border flex flex-col gap-1 animate-in slide-in-from-right-8 duration-500 delay-[${idx*100}ms] ${res.status === 'success' ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-red-500/5 border-red-500/20'}`}>
                                    <div className="flex items-center justify-between w-full">
                                       <div className="flex items-center gap-4">
                                          <div className={`p-2.5 rounded-2xl ${res.status === 'success' ? 'bg-emerald-500/20 text-emerald-500' : 'bg-red-500/20 text-red-500'}`}>
                                             {res.status === 'success' ? <CheckCircle size={18}/> : <AlertCircle size={18}/>}
                                          </div>
                                          <div className="overflow-hidden">
                                             <p className="text-sm font-black text-white truncate">{res.name}</p>
                                             <p className={`text-[10px] uppercase font-black tracking-widest ${res.status === 'success' ? 'text-emerald-500' : 'text-red-500'}`}>{res.status === 'success' ? 'Успешно' : 'Ошибка'}</p>
                                          </div>
                                       </div>
                                    </div>
                                    {res.status === 'failed' && res.error && (
                                      <div className="pl-12 mt-2">
                                         <p className="text-[10px] text-red-300/60 font-medium italic leading-relaxed">
                                           {res.error}
                                         </p>
                                      </div>
                                    )}
                                 </div>
                              ))}
                           </div>
                        ) : (
                           <div className="space-y-3">
                              {accounts.map(acc => (
                                 <div key={acc.id} className="flex items-center justify-between p-5 rounded-3xl bg-slate-900/50 border border-slate-800/50 group hover:border-indigo-500/40 transition-all">
                                    <div className="flex items-center gap-4">
                                       <div className="w-2.5 h-2.5 rounded-full bg-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.5)]"></div>
                                       <div>
                                          <p className="text-sm font-bold text-white group-hover:text-indigo-400 transition-colors">{acc.name}</p>
                                          <p className="text-[10px] text-slate-600 uppercase font-black tracking-widest">{acc.platform}</p>
                                       </div>
                                    </div>
                                    <Globe size={16} className="text-slate-800 group-hover:text-indigo-500/50 transition-colors" />
                                 </div>
                              ))}
                           </div>
                        )}
                     </div>
                  </div>

                  {!deployResults ? (
                    <button 
                      disabled={accounts.length === 0 || isDeploying}
                      onClick={handleDeploy}
                      className="w-full mt-auto py-6 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-900 disabled:text-slate-700 disabled:cursor-not-allowed rounded-[32px] font-black shadow-2xl shadow-indigo-600/30 transition-all flex items-center justify-center gap-3 text-white uppercase tracking-widest text-xs"
                    >
                       <Send size={20} /> Опубликовать выбранный
                    </button>
                  ) : (
                    <button 
                      onClick={() => { setSelectedArticle(null); setDeployResults(null); refreshData(); }}
                      className="w-full mt-auto py-6 bg-slate-800 hover:bg-slate-700 text-white rounded-[32px] font-black transition-all shadow-xl uppercase tracking-widest text-xs"
                    >
                       Завершить
                    </button>
                  )}
               </div>
            </div>
         </div>
      )}
    </div>
  );
};

export default App;
