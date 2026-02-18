
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
  Type as TypeIcon,
  Maximize2,
  AlignLeft,
  FileText,
  RectangleHorizontal,
  RectangleVertical,
  Square
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

  // Настройки креатора
  const [manualText, setManualText] = useState('');
  const [manualImageUrl, setManualImageUrl] = useState('');
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);
  const [creatorVariants, setCreatorVariants] = useState<RewriteVariant[]>([]);
  const [postLength, setPostLength] = useState<'post' | 'article' | 'longread'>('post');
  const [aspectRatio, setAspectRatio] = useState<'1:1' | '16:9' | '9:16'>('16:9');

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
      const base64 = await generateImageForArticle(prompt, aspectRatio);
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
    setProcessingStatus(`Gemini пишет ${postLength === 'post' ? 'пост' : 'статью'}...`);
    try {
      const variants = await rewriteArticle(manualText, postLength);
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
    setProcessingStatus('Gemini анализирует контент...');
    try {
      // При обработке из входящих используем экспертный стиль по умолчанию, 
      // но Gemini теперь знает про Федеральный Ипотечный Сервис.
      const variants = await rewriteArticle(article.originalText, 'article');
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
        const base64 = await generateImageForArticle(visualPrompt, '16:9');
        const publicUrl = await uploadImage(base64);
        
        const final = { ...initialApproved, generatedImageUrl: publicUrl };
        setSelectedArticle(final);
        setArticles(prev => prev.map(a => a.id === article.id ? final : a));
      } catch (imgError: any) {}
    } catch (error: any) {
      alert("Ошибка ИИ: " + error.message);
    } finally {
      setIsProcessing(false);
      setProcessingStatus('');
    }
  };

  const handleDeploy = async (preview: boolean = false) => {
    if (!selectedArticle) return;
    if (selectedAccountIds.length === 0) return alert("Выберите хотя бы одну площадку");

    setIsDeploying(true);
    if (!preview) setDeployResults(null);
    try {
      const result = await postToPlatforms(
        { ...selectedArticle, rewrittenText: editableText }, 
        preview, 
        selectedAccountIds // Теперь передаем выбранные аккаунты!
      );
      setDeployResults(result.results);
    } catch (e: any) {
      alert("Ошибка: " + e.message);
    } finally {
      setIsDeploying(false);
    }
  };

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

  return (
    <div className="flex flex-col lg:flex-row h-screen overflow-hidden bg-slate-950 text-slate-200 font-inter">
      {/* Sidebar - Desktop */}
      <aside className="hidden lg:flex w-72 glass border-r border-slate-800 flex-col p-6 space-y-8 z-20">
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

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto relative bg-slate-950/50 pb-24 lg:pb-0">
        <header className="sticky top-0 z-10 glass px-4 sm:px-10 py-4 flex justify-between items-center border-b border-slate-800/50">
          <div className="flex items-center gap-3">
             <div className="lg:hidden bg-indigo-600 p-2 rounded-lg"><Radio size={20} className="text-white"/></div>
             <h2 className="text-lg font-bold text-white capitalize">{activeTab === 'creator' ? 'Создать пост' : activeTab}</h2>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
             <div className="hidden sm:flex items-center gap-2 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-full border border-emerald-500/20">
               <Cpu size={12}/> AI ACTIVE
             </div>
             <button onClick={refreshData} className="text-[10px] font-bold text-indigo-400 bg-indigo-500/5 px-3 sm:px-4 py-2 rounded-full border border-indigo-500/20 uppercase">Обновить</button>
          </div>
        </header>

        <div className="p-4 sm:p-10 max-w-7xl mx-auto">
          {activeTab === 'creator' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-10 animate-in fade-in duration-500">
               <div className="lg:col-span-8 space-y-6 sm:space-y-8">
                  <div className="glass p-6 sm:p-10 rounded-[32px] sm:rounded-[48px] border border-slate-800 relative">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 sm:mb-10">
                      <h3 className="text-xl sm:text-2xl font-black text-white flex items-center gap-3"><PenTool className="text-indigo-500"/> Редактор</h3>
                      <div className="flex bg-slate-900/80 p-1 rounded-xl sm:rounded-2xl border border-slate-800 gap-1 w-full sm:w-auto">
                         <button onClick={() => setPostLength('post')} className={`flex-1 sm:flex-none px-3 sm:px-4 py-2 rounded-lg sm:rounded-xl text-[9px] sm:text-[10px] font-black uppercase transition-all ${postLength === 'post' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-slate-500 hover:text-white'}`}>Пост</button>
                         <button onClick={() => setPostLength('article')} className={`flex-1 sm:flex-none px-3 sm:px-4 py-2 rounded-lg sm:rounded-xl text-[9px] sm:text-[10px] font-black uppercase transition-all ${postLength === 'article' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-slate-500 hover:text-white'}`}>Статья</button>
                         <button onClick={() => setPostLength('longread')} className={`flex-1 sm:flex-none px-3 sm:px-4 py-2 rounded-lg sm:rounded-xl text-[9px] sm:text-[10px] font-black uppercase transition-all ${postLength === 'longread' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-slate-500 hover:text-white'}`}>Лонгрид</button>
                      </div>
                    </div>

                    {creatorVariants.length > 0 && (
                      <div className="mb-8 space-y-3 animate-in slide-in-from-top-4">
                        <label className="text-[10px] font-black uppercase text-indigo-400 tracking-widest px-2">Варианты ИИ:</label>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          {creatorVariants.map((v, i) => (
                            <button 
                              key={i} 
                              onClick={() => { setManualText(v.content); setCreatorVariants([]); }}
                              className="p-4 bg-slate-900 border border-slate-800 hover:border-indigo-500 rounded-2xl text-left transition-all"
                            >
                              <h4 className="text-[9px] font-black uppercase text-slate-500 mb-1">{v.title}</h4>
                              <p className="text-[11px] text-slate-300 line-clamp-3 leading-relaxed">{v.content}</p>
                            </button>
                          ))}
                          <button onClick={() => setCreatorVariants([])} className="p-3 bg-slate-800/50 rounded-xl text-[10px] font-bold text-slate-500 hover:text-white">Отмена</button>
                        </div>
                      </div>
                    )}

                    <textarea 
                      placeholder="Напишите тезисы или тему..." 
                      value={manualText}
                      onChange={e => setManualText(e.target.value)}
                      className="w-full min-h-[300px] sm:min-h-[400px] bg-slate-900/50 border border-slate-800 rounded-[24px] sm:rounded-[32px] p-6 sm:p-8 text-base sm:text-lg text-white outline-none focus:border-indigo-500 transition-all resize-none mb-6 sm:mb-8"
                    />

                    <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4">
                       <button 
                         onClick={handleManualAiRewrite} 
                         className="bg-indigo-600 hover:bg-indigo-500 px-6 sm:px-8 py-3.5 sm:py-4 rounded-xl sm:rounded-[24px] font-black text-white flex items-center justify-center gap-2 transition-all shadow-xl shadow-indigo-600/20"
                       >
                         <Wand2 size={20}/> {postLength === 'post' ? 'Написать пост' : 'Написать статью'}
                       </button>
                       
                       <div className="flex flex-col sm:flex-row bg-slate-900/50 p-1.5 sm:p-2 rounded-xl sm:rounded-[24px] border border-slate-800 gap-2 items-center">
                          <span className="hidden sm:block text-[9px] font-black uppercase text-slate-600 px-3 tracking-widest">Формат</span>
                          <div className="flex gap-1 w-full sm:w-auto">
                            <button onClick={() => setAspectRatio('1:1')} className={`flex-1 sm:flex-none p-3 rounded-lg sm:rounded-xl transition-all flex items-center justify-center ${aspectRatio === '1:1' ? 'bg-slate-700 text-white' : 'text-slate-600 hover:text-slate-400'}`} title="Square"><Square size={18}/></button>
                            <button onClick={() => setAspectRatio('16:9')} className={`flex-1 sm:flex-none p-3 rounded-lg sm:rounded-xl transition-all flex items-center justify-center ${aspectRatio === '16:9' ? 'bg-slate-700 text-white' : 'text-slate-600 hover:text-slate-400'}`} title="Landscape"><RectangleHorizontal size={18}/></button>
                            <button onClick={() => setAspectRatio('9:16')} className={`flex-1 sm:flex-none p-3 rounded-lg sm:rounded-xl transition-all flex items-center justify-center ${aspectRatio === '9:16' ? 'bg-slate-700 text-white' : 'text-slate-600 hover:text-slate-400'}`} title="Portrait"><RectangleVertical size={18}/></button>
                          </div>
                       </div>
                    </div>
                  </div>

                  {manualImageUrl && (
                    <div className="glass p-6 sm:p-10 rounded-[32px] sm:rounded-[48px] border border-slate-800 animate-in fade-in zoom-in duration-500">
                       <div className="flex justify-between items-center mb-6">
                         <h4 className="text-sm font-black uppercase text-slate-500 tracking-widest">Визуал</h4>
                         <button onClick={handleManualGenerateImage} className="text-[10px] font-black text-indigo-400 hover:text-indigo-300">ПЕРЕРИСОВАТЬ</button>
                       </div>
                       <img src={manualImageUrl} className="w-full rounded-[24px] sm:rounded-[32px] border border-slate-800 shadow-2xl" alt="Preview" />
                    </div>
                  )}
                  
                  {!manualImageUrl && manualText.trim().length > 10 && (
                    <button onClick={handleManualGenerateImage} className="w-full py-12 sm:py-16 glass border-2 border-dashed border-slate-800 rounded-[32px] sm:rounded-[40px] text-slate-500 hover:text-indigo-400 hover:border-indigo-500/30 transition-all flex flex-col items-center gap-4">
                       <ImageIconLucide size={40} className="opacity-20" />
                       <span className="font-bold uppercase tracking-widest text-[11px] px-6 text-center">Создать иллюстрацию Gemini</span>
                    </button>
                  )}
               </div>

               <div className="lg:col-span-4 space-y-8">
                  <div className="glass p-6 sm:p-10 rounded-[32px] sm:rounded-[40px] border border-slate-800 lg:sticky lg:top-28">
                    <h3 className="text-xl font-black text-white mb-6 sm:mb-8">Где постим?</h3>
                    <div className="space-y-2 sm:space-y-3">
                       {accounts.map(acc => (
                         <button 
                           key={acc.id} 
                           onClick={() => toggleAccountSelection(acc.id)}
                           className={`w-full p-4 sm:p-5 rounded-xl sm:rounded-2xl border flex items-center justify-between transition-all ${selectedAccountIds.includes(acc.id) ? 'bg-indigo-600/10 border-indigo-500 text-white' : 'bg-slate-900 border-slate-800 text-slate-500'}`}
                         >
                           <div className="flex items-center gap-3 sm:gap-4">
                             <div className={selectedAccountIds.includes(acc.id) ? 'text-indigo-400' : 'text-slate-700'}>{renderAccountIcon(acc.platform)}</div>
                             <span className="font-bold text-sm">{acc.name}</span>
                           </div>
                           {selectedAccountIds.includes(acc.id) ? <CheckCircle size={18} className="text-indigo-400"/> : <div className="w-[18px] h-[18px] rounded-full border-2 border-slate-800"></div>}
                         </button>
                       ))}
                    </div>

                    <div className="h-px bg-slate-800 my-8 sm:my-10"></div>

                    {!deployResults ? (
                      <button 
                        onClick={handleManualPublish}
                        disabled={isDeploying || !manualText.trim()}
                        className="w-full py-5 sm:py-6 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-[20px] sm:rounded-3xl font-black text-white uppercase text-xs tracking-widest shadow-2xl shadow-indigo-600/40 transition-all flex items-center justify-center gap-3"
                      >
                        {isDeploying ? <Loader2 className="animate-spin" /> : <><Rocket size={20}/> Опубликовать</>}
                      </button>
                    ) : (
                      <div className="space-y-4">
                        <h5 className="text-[10px] font-black uppercase text-indigo-400 text-center mb-4">Результат</h5>
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {articles.map(article => (
                <div key={article.id} className="glass p-6 sm:p-8 rounded-[28px] sm:rounded-[32px] border border-slate-800/50 flex flex-col h-full hover:border-indigo-500/30 transition-all">
                  <div className="flex justify-between items-center mb-6 text-[10px] font-bold text-indigo-400">
                    <span className="uppercase">{article.source}</span>
                    <span className="text-slate-600">{article.timestamp}</span>
                  </div>
                  <p className="text-slate-300 text-sm leading-relaxed mb-8 flex-1 line-clamp-5">{article.originalText}</p>
                  <button onClick={() => handleApprove(article)} className="w-full py-4 rounded-xl sm:rounded-2xl bg-indigo-600 hover:bg-indigo-500 font-bold text-white transition-all flex items-center justify-center gap-2 text-sm">
                    <Sparkles size={16} /> Обработать Gemini
                  </button>
                </div>
              ))}
              {articles.length === 0 && !isFetching && (
                <div className="col-span-full py-20 text-center text-slate-500">
                  <Inbox size={48} className="mx-auto mb-4 opacity-10" />
                  <p className="font-medium">Входящих постов пока нет</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'accounts' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
                <h3 className="text-2xl font-bold text-white">Каналы публикации</h3>
                <button onClick={openAddAccount} className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-500 px-6 py-4 rounded-2xl font-bold text-white flex items-center justify-center gap-2 transition-all">
                  <Plus size={20} /> Добавить канал
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {accounts.map(acc => (
                  <div key={acc.id} className="glass p-6 rounded-[24px] sm:rounded-3xl border border-slate-800 flex flex-col group hover:border-indigo-500/30 transition-all">
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
                <div className="glass p-6 sm:p-8 rounded-[32px] sm:rounded-[40px] border border-slate-800">
                  <h3 className="text-xl font-bold text-white mb-6">Источник (Telegram)</h3>
                  <form onSubmit={handleAddSource} className="flex flex-col sm:flex-row gap-4">
                    <input type="text" placeholder="@channel_name" value={newSourceUrl} onChange={e => setNewSourceUrl(e.target.value)} className="flex-1 bg-slate-900 border border-slate-800 rounded-xl sm:rounded-2xl px-6 py-4 text-white outline-none" />
                    <button className="bg-indigo-600 py-4 sm:py-0 px-8 rounded-xl sm:rounded-2xl font-bold text-white flex justify-center items-center"><Plus /></button>
                  </form>
                </div>
                <div className="space-y-3">
                  {sources.map(s => (
                    <div key={s.id} className="glass p-5 rounded-2xl sm:rounded-3xl border border-slate-800 flex items-center justify-between">
                      <div className="flex items-center gap-4 text-indigo-400"><Hash size={20} /> <span className="font-bold text-white truncate max-w-[200px]">{s.url}</span></div>
                      <button onClick={() => handleDeleteSource(s.id)} className="text-slate-600 hover:text-red-400 shrink-0"><Trash2 size={20}/></button>
                    </div>
                  ))}
                </div>
             </div>
          )}

          {activeTab === 'settings' && (
            <div className="max-w-xl glass p-8 sm:p-10 rounded-[32px] sm:rounded-[40px] border border-slate-800">
               <h3 className="text-2xl font-bold text-white mb-8">Настройки</h3>
               <div className="space-y-6">
                  <div className="p-5 bg-indigo-500/5 rounded-[20px] border border-indigo-500/10 text-xs text-slate-400 leading-relaxed">
                    Движок: Gemini 3 Flash (Text) & Gemini 2.5 (Image). Безопасность обеспечена нативным API.
                  </div>
                  <button onClick={() => setUser(null)} className="w-full flex items-center justify-center space-x-3 px-4 py-4 rounded-xl bg-red-500/10 text-red-400 border border-red-500/20 font-bold">
                    <LogOut size={20} /> <span>Выйти из аккаунта</span>
                  </button>
               </div>
            </div>
          )}
        </div>
      </main>

      {/* Bottom Navigation - Mobile */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 glass border-t border-slate-800 px-6 py-4 flex justify-between items-center z-50 rounded-t-3xl">
         <button onClick={() => setActiveTab('creator')} className={`p-2 rounded-xl transition-all ${activeTab === 'creator' ? 'text-indigo-400' : 'text-slate-500'}`}><PlusCircle size={24}/></button>
         <button onClick={() => setActiveTab('inbox')} className={`p-2 rounded-xl transition-all ${activeTab === 'inbox' ? 'text-indigo-400' : 'text-slate-500'}`}><Inbox size={24}/></button>
         <button onClick={() => setActiveTab('sources')} className={`p-2 rounded-xl transition-all ${activeTab === 'sources' ? 'text-indigo-400' : 'text-slate-500'}`}><Link2 size={24}/></button>
         <button onClick={() => setActiveTab('accounts')} className={`p-2 rounded-xl transition-all ${activeTab === 'accounts' ? 'text-indigo-400' : 'text-slate-500'}`}><UserCheck size={24}/></button>
         <button onClick={() => setActiveTab('settings')} className={`p-2 rounded-xl transition-all ${activeTab === 'settings' ? 'text-indigo-400' : 'text-slate-500'}`}><SettingsIcon size={24}/></button>
      </nav>

      {/* Overlays / Modals */}
      {showAddAccount && (
        <div className="fixed inset-0 z-[100] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass w-full max-w-xl p-8 sm:p-10 rounded-[32px] sm:rounded-[40px] border border-white/5 animate-in zoom-in duration-300">
            <h3 className="text-2xl font-bold text-white mb-2">{editingAccount ? 'Редактировать' : 'Добавить'} канал</h3>
            <div className="space-y-4 mt-8">
              <div className="grid grid-cols-3 gap-2">
                 {Object.values(Platform).map(p => (
                   <button key={p} onClick={() => setNewAccPlatform(p)} className={`py-3 rounded-xl sm:rounded-2xl border font-bold text-[9px] sm:text-[10px] flex flex-col items-center gap-1 transition-all ${newAccPlatform === p ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-900 border-slate-800 text-slate-500'}`}>
                     {renderAccountIcon(p)} {p}
                   </button>
                 ))}
              </div>
              <input placeholder="Название" value={newAccName} onChange={e => setNewAccName(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-xl sm:rounded-2xl px-6 py-4 text-white outline-none" />
              {newAccPlatform === Platform.TELEGRAM && (
                <div className="space-y-3">
                  <input placeholder="Bot Token" value={newAccCreds.botToken || ''} onChange={e => setNewAccCreds({...newAccCreds, botToken: e.target.value})} className="w-full bg-slate-900 border border-slate-800 rounded-xl px-6 py-4 text-white outline-none text-sm" />
                  <input placeholder="Chat ID (@channel)" value={newAccCreds.chatId || ''} onChange={e => setNewAccCreds({...newAccCreds, chatId: e.target.value})} className="w-full bg-slate-900 border border-slate-800 rounded-xl px-6 py-4 text-white outline-none text-sm" />
                </div>
              )}
              {newAccPlatform === Platform.VK && (
                <div className="space-y-3">
                   <input placeholder="Access Token" value={newAccCreds.accessToken || ''} onChange={e => setNewAccCreds({...newAccCreds, accessToken: e.target.value})} className="w-full bg-slate-900 border border-slate-800 rounded-xl px-6 py-4 text-white outline-none text-sm" />
                   <input placeholder="ID владельца (-12345)" value={newAccCreds.ownerId || ''} onChange={e => setNewAccCreds({...newAccCreds, ownerId: e.target.value})} className="w-full bg-slate-900 border border-slate-800 rounded-xl px-6 py-4 text-white outline-none text-sm" />
                </div>
              )}
               {newAccPlatform === Platform.INSTAGRAM && (
                <div className="space-y-3">
                   <input placeholder="Access Token" value={newAccCreds.accessToken || ''} onChange={e => setNewAccCreds({...newAccCreds, accessToken: e.target.value})} className="w-full bg-slate-900 border border-slate-800 rounded-xl px-6 py-4 text-white outline-none text-sm" />
                   <input placeholder="Instagram ID (numeric)" value={newAccCreds.igUserId || ''} onChange={e => setNewAccCreds({...newAccCreds, igUserId: e.target.value})} className="w-full bg-slate-900 border border-slate-800 rounded-xl px-6 py-4 text-white outline-none text-sm" />
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
        <div className="fixed inset-0 z-[110] bg-slate-950/80 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center">
           <div className="w-20 h-20 sm:w-24 sm:h-24 border-4 border-indigo-500/10 border-t-indigo-500 rounded-full animate-spin mb-6"></div>
           <p className="text-white text-lg sm:text-xl font-black">{processingStatus || 'Нейросети работают...'}</p>
        </div>
      )}

      {selectedArticle && !isDeploying && activeTab !== 'creator' && (
         <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-6 bg-slate-950/90 backdrop-blur-xl">
            <div className="glass w-full h-full sm:max-w-7xl sm:max-h-[95vh] rounded-none sm:rounded-[48px] border border-white/5 overflow-hidden flex flex-col lg:flex-row shadow-2xl">
               <div className="flex-1 p-6 sm:p-14 overflow-y-auto border-b lg:border-r lg:border-b-0 border-slate-800/50 flex flex-col">
                  <div className="flex justify-between items-center mb-8 lg:mb-12">
                    <h3 className="text-2xl sm:text-3xl font-black text-white">Редактор поста</h3>
                    <button onClick={() => { setSelectedArticle(null); setDeployResults(null); }} className="lg:hidden"><XCircle size={28} className="text-slate-600 hover:text-white"/></button>
                  </div>
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
                     <div className="lg:col-span-5 space-y-4 lg:space-y-5 order-2 lg:order-1">
                        <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest px-2">Варианты ИИ</label>
                        {selectedArticle.rewrittenVariants?.map((variant, idx) => (
                           <button key={idx} onClick={() => { setEditableText(variant.content); setSelectedArticle({...selectedArticle, selectedVariantIndex: idx}); }} className={`w-full p-5 lg:p-6 rounded-2xl lg:rounded-3xl border text-left transition-all ${selectedArticle.selectedVariantIndex === idx ? 'bg-indigo-600/10 border-indigo-500' : 'bg-slate-900/40 border-slate-800 hover:border-slate-700'}`}>
                              <h4 className="font-black text-[11px] uppercase text-indigo-400 mb-1 lg:mb-2">{variant.title}</h4>
                              <p className="text-[12px] sm:text-sm text-slate-300 line-clamp-3 leading-relaxed">{variant.content}</p>
                           </button>
                        ))}
                     </div>
                     <div className="lg:col-span-7 space-y-6 lg:space-y-8 order-1 lg:order-2">
                        {selectedArticle.generatedImageUrl && (
                          <img src={selectedArticle.generatedImageUrl} className="w-full rounded-[24px] lg:rounded-[40px] border border-slate-800 shadow-2xl" alt="Preview" />
                        )}
                        <textarea 
                           value={editableText}
                           onChange={(e) => setEditableText(e.target.value)}
                           className="w-full min-h-[150px] lg:min-h-[200px] p-6 lg:p-8 bg-slate-900/50 rounded-[20px] lg:rounded-[32px] border border-slate-800 text-slate-100 outline-none focus:border-indigo-500/50 transition-all resize-none text-sm lg:text-base"
                        />
                     </div>
                  </div>
               </div>
               <div className="w-full lg:w-[350px] p-8 lg:p-12 bg-slate-950/60 backdrop-blur-md flex flex-col shrink-0">
                  <button onClick={() => { setSelectedArticle(null); setDeployResults(null); }} className="hidden lg:block self-end mb-12"><XCircle size={28} className="text-slate-600 hover:text-white"/></button>
                  <div className="flex-1 space-y-3 lg:space-y-4 overflow-y-auto mb-6 lg:mb-0">
                     <h5 className="text-[10px] font-black uppercase text-slate-500 mb-3 lg:mb-4 px-2">Выберите каналы</h5>
                     {deployResults ? deployResults.map((res: any, idx: number) => (
                        <div key={idx} className={`p-4 rounded-xl lg:rounded-2xl border ${res.status === 'success' ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-red-500/5 border-red-500/20'}`}>
                           <div className="flex justify-between items-center text-[11px] font-bold">
                             <span className="text-white truncate max-w-[150px]">{res.name}</span>
                             {res.status === 'success' ? <CheckCircle size={14} className="text-emerald-500"/> : <ShieldAlert size={14} className="text-red-500"/>}
                           </div>
                        </div>
                     )) : accounts.map(acc => (
                        <button 
                          key={acc.id} 
                          onClick={() => toggleAccountSelection(acc.id)}
                          className={`w-full p-3 lg:p-4 rounded-xl lg:rounded-2xl border flex items-center justify-between transition-all ${selectedAccountIds.includes(acc.id) ? 'bg-indigo-600/10 border-indigo-500' : 'bg-slate-900/50 border-slate-800/50'}`}
                        >
                           <div className="flex items-center gap-2">
                             <div className={selectedAccountIds.includes(acc.id) ? 'text-indigo-400' : 'text-slate-700'}>{renderAccountIcon(acc.platform)}</div>
                             <span className="text-[11px] font-bold text-white truncate max-w-[120px]">{acc.name}</span>
                           </div>
                           {selectedAccountIds.includes(acc.id) && <Check size={14} className="text-indigo-400"/>}
                        </button>
                     ))}
                  </div>
                  {!deployResults ? (
                    <button onClick={() => handleDeploy(false)} className="w-full mt-4 lg:mt-8 py-4 lg:py-5 bg-indigo-600 hover:bg-indigo-500 rounded-[16px] lg:rounded-[24px] font-black text-white uppercase text-[10px] tracking-widest transition-all">Опубликовать</button>
                  ) : (
                    <button onClick={() => { setSelectedArticle(null); setDeployResults(null); refreshData(); }} className="w-full mt-4 lg:mt-8 py-4 lg:py-5 bg-slate-800 hover:bg-slate-700 text-white rounded-[16px] lg:rounded-[24px] font-black uppercase text-[10px]">Закрыть</button>
                  )}
               </div>
            </div>
         </div>
      )}
    </div>
  );
};

export default App;
