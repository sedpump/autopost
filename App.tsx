
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
  Smartphone,
  Copy,
  Terminal,
  Eye,
  AlertTriangle,
  Facebook,
  CloudUpload,
  Image as ImageIconLucide,
  Cpu,
  RefreshCw,
  PenTool,
  PlusCircle,
  Wand2,
  Type as TypeIcon
} from 'lucide-react';
import { Platform, Article, PostingStatus, Source, Account, User, RewriteVariant } from './types';
import { rewriteArticle, generateImageForArticle, extractVisualPrompt } from './geminiService';
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
  deleteAccount,
  uploadImage
} from './apiService';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('omni_user');
    return saved ? JSON.parse(saved) : null;
  });
  
  const [activeTab, setActiveTab] = useState<'inbox' | 'sources' | 'accounts' | 'settings' | 'creator'>('inbox');
  const [articles, setArticles] = useState<Article[]>([]);
  const [sources, setSources] = useState<Source[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [newSourceUrl, setNewSourceUrl] = useState('');
  const [isFetching, setIsFetching] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState('');
  const [isDeploying, setIsDeploying] = useState(false);
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [editableText, setEditableText] = useState('');
  const [deployResults, setDeployResults] = useState<any[] | null>(null);
  
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [newAccPlatform, setNewAccPlatform] = useState<Platform>(Platform.TELEGRAM);
  const [newAccName, setNewAccName] = useState('');
  const [newAccCreds, setNewAccCreds] = useState<any>({});
  
  const [username, setUsername] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  const [genError, setGenError] = useState<string | null>(null);

  // Для свободного постинга
  const [manualText, setManualText] = useState('');
  const [manualImageUrl, setManualImageUrl] = useState('');
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);
  const [creatorVariants, setCreatorVariants] = useState<RewriteVariant[]>([]);

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
      if (selectedAccountIds.length === 0) {
        setSelectedAccountIds(newAccounts.map(a => a.id));
      }
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
    let finalCreds = { ...newAccCreds };
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

  const handleManualGenerateImage = async () => {
    if (!manualText.trim()) {
      alert("Сначала напишите текст поста, чтобы ИИ понял, что рисовать");
      return;
    }
    setIsProcessing(true);
    setProcessingStatus('Gemini создает визуальный концепт...');
    try {
      const prompt = await extractVisualPrompt(manualText);
      const base64 = await generateImageForArticle(prompt);
      setManualImageUrl(base64);
      
      setProcessingStatus('Загружаем в облако...');
      const publicUrl = await uploadImage(base64);
      setManualImageUrl(publicUrl);
    } catch (e: any) {
      alert("Ошибка ИИ: " + e.message);
    } finally {
      setIsProcessing(false);
      setProcessingStatus('');
    }
  };

  const handleManualAiRewrite = async () => {
    if (!manualText.trim()) {
      alert("Сначала напишите хотя бы пару слов или тему поста");
      return;
    }
    setIsProcessing(true);
    setProcessingStatus('Gemini пишет статью...');
    try {
      const variants = await rewriteArticle(manualText);
      setCreatorVariants(variants);
    } catch (e: any) {
      alert("Ошибка ИИ: " + e.message);
    } finally {
      setIsProcessing(false);
      setProcessingStatus('');
    }
  };

  const handleManualPublish = async () => {
    if (!manualText.trim()) return alert("Текст поста не может быть пустым");
    if (selectedAccountIds.length === 0) return alert("Выберите хотя бы одну площадку");

    setIsDeploying(true);
    setDeployResults(null);
    try {
      const result = await postToPlatforms({
        id: 'manual_' + Date.now(),
        userId: user?.id || '',
        source: 'Manual Creator',
        originalText: manualText,
        rewrittenText: manualText,
        generatedImageUrl: manualImageUrl,
        timestamp: new Date().toISOString(),
        status: 'approved'
      }, false, selectedAccountIds);
      
      setDeployResults(result.results);
    } catch (e: any) {
      alert("Ошибка публикации: " + e.message);
    } finally {
      setIsDeploying(false);
    }
  };

  const toggleAccountSelection = (id: string) => {
    setSelectedAccountIds(prev => 
      prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]
    );
  };

  const handleApprove = async (article: Article) => {
    setIsProcessing(true);
    setGenError(null);
    setProcessingStatus('Gemini анализирует контент...');
    try {
      const variants = await rewriteArticle(article.originalText);
      setEditableText(variants[0].content);
      
      const initialApproved: Article = {
        ...article,
        status: 'approved',
        rewrittenVariants: variants,
        selectedVariantIndex: 0,
        rewrittenText: variants[0].content,
      };
      
      setSelectedArticle(initialApproved);
      setArticles(prev => prev.map(a => a.id === article.id ? initialApproved : a));

      setProcessingStatus('Создаем визуальный образ...');
      try {
        const visualPrompt = await extractVisualPrompt(variants[0].content);
        const base64 = await generateImageForArticle(visualPrompt);
        const publicUrl = await uploadImage(base64);
        
        const final = { ...initialApproved, generatedImageUrl: publicUrl };
        setSelectedArticle(final);
        setArticles(prev => prev.map(a => a.id === article.id ? final : a));
      } catch (imgError: any) {
        setGenError(imgError.message || "Не удалось создать картинку");
      }
    } catch (error: any) {
      alert("Ошибка ИИ: " + error.message);
    } finally {
      setIsProcessing(false);
      setProcessingStatus('');
    }
  };

  const handleDeploy = async (preview: boolean = false) => {
    if (!selectedArticle) return;
    setIsDeploying(true);
    if (!preview) setDeployResults(null);
    try {
      const result = await postToPlatforms({ 
        ...selectedArticle, 
        rewrittenText: editableText 
      }, preview);
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
          <button onClick={() => setActiveTab('creator')} className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'creator' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800'}`}>
            <PlusCircle size={20} /> <span className="font-medium">Создать пост</span>
          </button>
          <div className="h-px bg-slate-800 my-4 opacity-50"></div>
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
          <h2 className="text-lg font-bold text-white capitalize">{activeTab === 'creator' ? 'Свободный постинг' : activeTab}</h2>
          <div className="flex items-center gap-4">
             <div className="flex items-center gap-2 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-full border border-emerald-500/20">
               <Cpu size={12}/> AI ACTIVE
             </div>
             <button onClick={refreshData} className="text-[10px] font-bold text-indigo-400 bg-indigo-500/5 px-4 py-2 rounded-full border border-indigo-500/20 uppercase">Обновить</button>
          </div>
        </header>

        <div className="p-10 max-w-7xl mx-auto">
          {activeTab === 'creator' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 animate-in fade-in duration-500">
               <div className="lg:col-span-8 space-y-8">
                  <div className="glass p-10 rounded-[48px] border border-slate-800">
                    <div className="flex justify-between items-center mb-8">
                      <h3 className="text-2xl font-black text-white flex items-center gap-3"><PenTool className="text-indigo-500"/> Напишите пост</h3>
                      <button 
                        onClick={handleManualAiRewrite} 
                        className="bg-indigo-600 hover:bg-indigo-500 px-6 py-3 rounded-2xl font-bold text-white flex items-center gap-2 transition-all shadow-lg shadow-indigo-600/20"
                      >
                        <Wand2 size={18}/> Написать через AI
                      </button>
                    </div>

                    {creatorVariants.length > 0 && (
                      <div className="mb-8 space-y-3 animate-in slide-in-from-top-4">
                        <label className="text-[10px] font-black uppercase text-indigo-400 tracking-widest px-2">Выберите вариант текста:</label>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          {creatorVariants.map((v, i) => (
                            <button 
                              key={i} 
                              onClick={() => { setManualText(v.content); setCreatorVariants([]); }}
                              className="p-4 bg-slate-900 border border-slate-800 hover:border-indigo-500 rounded-2xl text-left transition-all"
                            >
                              <h4 className="text-[9px] font-black uppercase text-slate-500 mb-2">{v.title}</h4>
                              <p className="text-[11px] text-slate-300 line-clamp-3">{v.content}</p>
                            </button>
                          ))}
                          <button onClick={() => setCreatorVariants([])} className="p-4 bg-slate-800/50 rounded-2xl text-[10px] font-bold text-slate-500 hover:text-white">Отмена</button>
                        </div>
                      </div>
                    )}

                    <textarea 
                      placeholder="О чем расскажем сегодня? Напишите тему или тезисы, и нажмите 'Написать через AI'..." 
                      value={manualText}
                      onChange={e => setManualText(e.target.value)}
                      className="w-full min-h-[300px] bg-slate-900/50 border border-slate-800 rounded-[32px] p-8 text-lg text-white outline-none focus:border-indigo-500 transition-all resize-none mb-6"
                    />
                    <div className="flex justify-between items-center">
                       <button onClick={handleManualGenerateImage} className="px-8 py-4 bg-slate-800 hover:bg-slate-700 rounded-2xl font-bold text-white flex items-center gap-2 transition-all">
                         <ImageIconLucide size={20}/> {manualImageUrl ? 'Перерисовать арт' : 'Сгенерировать арт'}
                       </button>
                       <div className="text-slate-500 text-xs font-medium italic">Gemini автоматически создаст иллюстрацию по тексту</div>
                    </div>
                  </div>

                  {manualImageUrl && (
                    <div className="glass p-10 rounded-[48px] border border-slate-800">
                       <h4 className="text-sm font-black uppercase text-slate-500 mb-6 tracking-widest">Визуальное сопровождение</h4>
                       <img src={manualImageUrl} className="w-full rounded-[32px] border border-slate-800 shadow-2xl" alt="Preview" />
                    </div>
                  )}
               </div>

               <div className="lg:col-span-4 space-y-8">
                  <div className="glass p-10 rounded-[40px] border border-slate-800">
                    <h3 className="text-xl font-black text-white mb-8">Куда пуляем?</h3>
                    <div className="space-y-3">
                       {accounts.map(acc => (
                         <button 
                           key={acc.id} 
                           onClick={() => toggleAccountSelection(acc.id)}
                           className={`w-full p-5 rounded-2xl border flex items-center justify-between transition-all ${selectedAccountIds.includes(acc.id) ? 'bg-indigo-600/10 border-indigo-500 text-white' : 'bg-slate-900 border-slate-800 text-slate-500'}`}
                         >
                           <div className="flex items-center gap-4">
                             <div className={selectedAccountIds.includes(acc.id) ? 'text-indigo-400' : 'text-slate-700'}>{renderAccountIcon(acc.platform)}</div>
                             <span className="font-bold text-sm">{acc.name}</span>
                           </div>
                           {selectedAccountIds.includes(acc.id) ? <CheckCircle size={18} className="text-indigo-400"/> : <div className="w-[18px] h-[18px] rounded-full border-2 border-slate-800"></div>}
                         </button>
                       ))}
                       {accounts.length === 0 && <p className="text-slate-500 text-sm text-center py-4">Нет активных аккаунтов</p>}
                    </div>

                    <div className="h-px bg-slate-800 my-10"></div>

                    {!deployResults ? (
                      <button 
                        onClick={handleManualPublish}
                        disabled={isDeploying || !manualText.trim()}
                        className="w-full py-5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-3xl font-black text-white uppercase text-xs tracking-widest shadow-xl shadow-indigo-600/20 transition-all flex items-center justify-center gap-3"
                      >
                        {isDeploying ? <Loader2 className="animate-spin" /> : <><Rocket size={20}/> Опубликовать</>}
                      </button>
                    ) : (
                      <div className="space-y-4">
                        <h5 className="text-[10px] font-black uppercase text-indigo-400 text-center mb-4">Результат публикации</h5>
                        {deployResults.map((res: any, idx: number) => (
                           <div key={idx} className={`p-4 rounded-xl border flex justify-between items-center text-xs font-bold ${res.status === 'success' ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-400' : 'bg-red-500/5 border-red-500/20 text-red-400'}`}>
                             <span>{res.name}</span>
                             {res.status === 'success' ? <CheckCircle size={14}/> : <ShieldAlert size={14}/>}
                           </div>
                        ))}
                        <button onClick={() => { setDeployResults(null); setManualText(''); setManualImageUrl(''); setCreatorVariants([]); }} className="w-full py-4 mt-4 bg-slate-800 rounded-2xl font-bold text-white text-xs">Новый пост</button>
                      </div>
                    )}
                  </div>
               </div>
            </div>
          )}

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
            </div>
          )}

          {activeTab === 'accounts' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-2xl font-bold text-white">Каналы публикации</h3>
                <button onClick={openAddAccount} className="bg-indigo-600 hover:bg-indigo-500 px-6 py-3 rounded-2xl font-bold text-white flex items-center gap-2 transition-all">
                  <Plus size={20} /> Добавить канал
                </button>
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
                  <div className="flex-1 p-5 bg-indigo-500/5 rounded-3xl border border-indigo-500/10 text-xs text-slate-500">
                    Gemini 3 Flash (Text) & Gemini 2.5 (Image)
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
            <div className="space-y-4 mt-8">
              <div className="grid grid-cols-3 gap-2">
                 {Object.values(Platform).map(p => (
                   <button key={p} onClick={() => setNewAccPlatform(p)} className={`py-3 rounded-2xl border font-bold text-[10px] flex flex-col items-center gap-1 transition-all ${newAccPlatform === p ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-900 border-slate-800 text-slate-500'}`}>
                     {renderAccountIcon(p)} {p}
                   </button>
                 ))}
              </div>
              <input placeholder="Название" value={newAccName} onChange={e => setNewAccName(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-2xl px-6 py-4 text-white outline-none" />
              {newAccPlatform === Platform.TELEGRAM && (
                <div className="space-y-3">
                  <input placeholder="Bot Token" value={newAccCreds.botToken || ''} onChange={e => setNewAccCreds({...newAccCreds, botToken: e.target.value})} className="w-full bg-slate-900 border border-slate-800 rounded-2xl px-6 py-4 text-white outline-none text-sm" />
                  <input placeholder="Chat ID (@channel)" value={newAccCreds.chatId || ''} onChange={e => setNewAccCreds({...newAccCreds, chatId: e.target.value})} className="w-full bg-slate-900 border border-slate-800 rounded-2xl px-6 py-4 text-white outline-none text-sm" />
                </div>
              )}
              {newAccPlatform === Platform.VK && (
                <div className="space-y-3">
                   <input placeholder="Access Token" value={newAccCreds.accessToken || ''} onChange={e => setNewAccCreds({...newAccCreds, accessToken: e.target.value})} className="w-full bg-slate-900 border border-slate-800 rounded-2xl px-6 py-4 text-white outline-none text-sm" />
                   <input placeholder="ID владельца (-12345)" value={newAccCreds.ownerId || ''} onChange={e => setNewAccCreds({...newAccCreds, ownerId: e.target.value})} className="w-full bg-slate-900 border border-slate-800 rounded-2xl px-6 py-4 text-white outline-none text-sm" />
                </div>
              )}
               {newAccPlatform === Platform.INSTAGRAM && (
                <div className="space-y-3">
                   <input placeholder="Access Token" value={newAccCreds.accessToken || ''} onChange={e => setNewAccCreds({...newAccCreds, accessToken: e.target.value})} className="w-full bg-slate-900 border border-slate-800 rounded-2xl px-6 py-4 text-white outline-none text-sm" />
                   <input placeholder="Instagram ID (numeric)" value={newAccCreds.igUserId || ''} onChange={e => setNewAccCreds({...newAccCreds, igUserId: e.target.value})} className="w-full bg-slate-900 border border-slate-800 rounded-2xl px-6 py-4 text-white outline-none text-sm" />
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
           <div className="w-24 h-24 border-4 border-indigo-500/10 border-t-indigo-500 rounded-full animate-spin mb-6"></div>
           <p className="text-white text-xl font-black">{processingStatus || 'Нейросети работают...'}</p>
        </div>
      )}

      {selectedArticle && !isDeploying && activeTab !== 'creator' && (
         <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-950/90 backdrop-blur-xl">
            <div className="glass w-full max-w-7xl max-h-[95vh] rounded-[48px] border border-white/5 overflow-hidden flex shadow-2xl">
               <div className="flex-1 p-14 overflow-y-auto border-r border-slate-800/50 flex flex-col">
                  <h3 className="text-3xl font-black text-white mb-12">Редактор поста</h3>
                  <div className="grid grid-cols-12 gap-12">
                     <div className="col-span-5 space-y-5">
                        <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest px-2">Варианты ИИ</label>
                        {selectedArticle.rewrittenVariants?.map((variant, idx) => (
                           <button key={idx} onClick={() => { setEditableText(variant.content); setSelectedArticle({...selectedArticle, selectedVariantIndex: idx}); }} className={`w-full p-6 rounded-3xl border text-left transition-all ${selectedArticle.selectedVariantIndex === idx ? 'bg-indigo-600/10 border-indigo-500' : 'bg-slate-900/40 border-slate-800 hover:border-slate-700'}`}>
                              <h4 className="font-black text-[11px] uppercase text-indigo-400 mb-2">{variant.title}</h4>
                              <p className="text-sm text-slate-300 line-clamp-3 leading-relaxed">{variant.content}</p>
                           </button>
                        ))}
                     </div>
                     <div className="col-span-7 space-y-8">
                        {selectedArticle.generatedImageUrl && (
                          <img src={selectedArticle.generatedImageUrl} className="w-full rounded-[40px] border border-slate-800 shadow-2xl" alt="Preview" />
                        )}
                        <textarea 
                           value={editableText}
                           onChange={(e) => setEditableText(e.target.value)}
                           className="w-full min-h-[200px] p-8 bg-slate-900/50 rounded-[32px] border border-slate-800 text-slate-100 outline-none focus:border-indigo-500/50 transition-all resize-none"
                        />
                     </div>
                  </div>
               </div>
               <div className="w-[350px] p-12 bg-slate-950/60 backdrop-blur-md flex flex-col">
                  <button onClick={() => { setSelectedArticle(null); setDeployResults(null); }} className="self-end mb-12"><XCircle size={28} className="text-slate-600 hover:text-white"/></button>
                  <div className="flex-1 space-y-4 overflow-y-auto">
                     <h5 className="text-[10px] font-black uppercase text-slate-500 mb-4 px-2">Каналы</h5>
                     {deployResults ? deployResults.map((res: any, idx: number) => (
                        <div key={idx} className={`p-4 rounded-2xl border ${res.status === 'success' ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-red-500/5 border-red-500/20'}`}>
                           <div className="flex justify-between items-center text-xs font-bold">
                             <span className="text-white">{res.name}</span>
                             {res.status === 'success' ? <CheckCircle size={14} className="text-emerald-500"/> : <ShieldAlert size={14} className="text-red-500"/>}
                           </div>
                        </div>
                     )) : accounts.map(acc => (
                        <div key={acc.id} className="p-4 rounded-2xl bg-slate-900/50 border border-slate-800/50 flex items-center justify-between">
                           <span className="text-xs font-bold text-white">{acc.name}</span>
                           <div className="text-slate-700">{renderAccountIcon(acc.platform)}</div>
                        </div>
                     ))}
                  </div>
                  {!deployResults ? (
                    <button onClick={() => handleDeploy(false)} className="w-full mt-8 py-5 bg-indigo-600 hover:bg-indigo-500 rounded-[24px] font-black text-white uppercase text-[10px] tracking-widest transition-all">Опубликовать во все</button>
                  ) : (
                    <button onClick={() => { setSelectedArticle(null); setDeployResults(null); refreshData(); }} className="w-full mt-8 py-5 bg-slate-800 hover:bg-slate-700 text-white rounded-[24px] font-black uppercase text-[10px]">Закрыть</button>
                  )}
               </div>
            </div>
         </div>
      )}
    </div>
  );
};

export default App;
