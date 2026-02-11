
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
  RefreshCw
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
  
  const [activeTab, setActiveTab] = useState<'inbox' | 'sources' | 'accounts' | 'settings'>('inbox');
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
  const [vkAppId, setVkAppId] = useState('');

  const [username, setUsername] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  const [showDebugModal, setShowDebugModal] = useState<any>(null);
  const [genError, setGenError] = useState<string | null>(null);

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
    setVkAppId('');
    setShowAddAccount(true);
  };

  const openEditAccount = (acc: Account) => {
    setEditingAccount(acc);
    setNewAccPlatform(acc.platform);
    setNewAccName(acc.name);
    setNewAccCreds(acc.credentials);
    setVkAppId('');
    setShowAddAccount(true);
  };

  const handleSaveAccount = async () => {
    let finalCreds = { ...newAccCreds };
    if (newAccPlatform === Platform.TELEGRAM && finalCreds.chatId) {
      let cid = finalCreds.chatId.trim();
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
      alert("Ошибка запроса: " + e.message);
    } finally {
      setIsDeploying(false);
    }
  };

  const handleRegenerateImage = async () => {
    if (!selectedArticle) return;
    setIsProcessing(true);
    setGenError(null);
    setProcessingStatus('Gemini рисует... (может занять до 15 сек)');
    try {
      const visualPrompt = await extractVisualPrompt(editableText);
      const base64 = await generateImageForArticle(visualPrompt);
      
      const updatedWithBase64 = { ...selectedArticle, generatedImageUrl: base64 };
      setSelectedArticle(updatedWithBase64);
      
      setProcessingStatus('Сохраняем в облако...');
      try {
        const publicUrl = await uploadImage(base64);
        const finalArticle = { ...updatedWithBase64, generatedImageUrl: publicUrl };
        setSelectedArticle(finalArticle);
        setArticles(prev => prev.map(a => a.id === selectedArticle.id ? finalArticle : a));
      } catch (uploadErr: any) {
        console.warn("Cloud upload failed", uploadErr.message);
      }
    } catch (e: any) {
      setGenError(e.message || "Ошибка генерации изображения");
    } finally {
      setIsProcessing(false);
      setProcessingStatus('');
    }
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
        
        const withImage = { ...initialApproved, generatedImageUrl: base64 };
        setSelectedArticle(withImage);

        try {
          const publicUrl = await uploadImage(base64);
          const final = { ...withImage, generatedImageUrl: publicUrl };
          setSelectedArticle(final);
          setArticles(prev => prev.map(a => a.id === article.id ? final : a));
        } catch (upErr) {}
      } catch (imgError: any) {
        setGenError(imgError.message || "Не удалось создать картинку");
      }
    } catch (error: any) {
      alert("Ошибка ИИ: " + error.message);
      setSelectedArticle(null);
    } finally {
      setIsProcessing(false);
      setProcessingStatus('');
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

  const handleDeploy = async (preview: boolean = false) => {
    if (!selectedArticle) return;
    setIsDeploying(true);
    if (!preview) setDeployResults(null);
    try {
      const result = await postToPlatforms({ 
        ...selectedArticle, 
        rewrittenText: editableText 
      }, preview);
      
      if (preview) {
        const debugRes = result.results.find((r: any) => r.debugData);
        if (debugRes) {
          setShowDebugModal(debugRes.debugData);
        } else {
          alert("Превью недоступно для этого канала");
        }
      } else {
        setDeployResults(result.results);
      }
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

  const generateVkAuthLink = () => {
    if (!vkAppId.trim()) return;
    const link = `https://oauth.vk.com/authorize?client_id=${vkAppId.trim()}&display=page&redirect_uri=https://oauth.vk.com/blank.html&scope=wall,photos,offline&response_type=token&v=5.131`;
    window.open(link, '_blank');
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
          <div className="flex items-center gap-4">
             <div className="flex items-center gap-2 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-full border border-emerald-500/20">
               <Cpu size={12}/> AI ACTIVE
             </div>
             <button onClick={refreshData} className="text-[10px] font-bold text-indigo-400 bg-indigo-500/5 px-4 py-2 rounded-full border border-indigo-500/20 uppercase">Обновить</button>
          </div>
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
                   <Inbox size={48} className="mx-auto mb-4 opacity-20"/>
                   <p>Входящих сообщений пока нет</p>
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
                  <div className="flex-1 p-5 bg-indigo-500/5 rounded-3xl border border-indigo-500/10">
                    <h4 className="font-bold mb-2">Статус API</h4>
                    <p className="text-xs text-slate-500">Система использует Gemini 3 Pro (Text) и Gemini 2.5 (Image).</p>
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

              <input placeholder="Название (напр. 'Мой паблик')" value={newAccName} onChange={e => setNewAccName(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-2xl px-6 py-4 text-white outline-none" />

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
           <div className="relative mb-6">
              <div className="w-24 h-24 border-4 border-indigo-500/10 border-t-indigo-500 rounded-full animate-spin"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                 <Sparkles className="text-indigo-400 animate-pulse" size={32}/>
              </div>
           </div>
           <p className="text-white text-xl font-black tracking-wide text-center max-w-md px-6">{isDeploying ? 'Публикация контента...' : (processingStatus || 'Нейросети работают...')}</p>
        </div>
      )}

      {selectedArticle && !isDeploying && (
         <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-950/90 backdrop-blur-xl">
            <div className="glass w-full max-w-7xl max-h-[95vh] rounded-[48px] border border-white/5 overflow-hidden flex shadow-2xl animate-in slide-in-from-bottom-12">
               <div className="flex-1 p-14 overflow-y-auto border-r border-slate-800/50 flex flex-col">
                  <div className="flex justify-between items-center mb-12">
                    <h3 className="text-3xl font-black text-white">Редактор поста</h3>
                    <div className="flex gap-4">
                       <button onClick={() => handleApprove(selectedArticle)} className="p-3 bg-indigo-500/10 text-indigo-400 rounded-2xl hover:bg-indigo-500/20 transition-all" title="Обновить всё">
                         <RefreshCw size={20}/>
                       </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
                     <div className="lg:col-span-5 space-y-5">
                        <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest px-2">Варианты текста</label>
                        {selectedArticle.rewrittenVariants?.map((variant, idx) => (
                           <button key={idx} onClick={() => handleSelectVariant(idx)} className={`w-full p-6 rounded-3xl border text-left transition-all ${selectedArticle.selectedVariantIndex === idx ? 'bg-indigo-600/10 border-indigo-500' : 'bg-slate-900/40 border-slate-800 hover:border-slate-700'}`}>
                              <h4 className="font-black text-[11px] uppercase text-indigo-400 mb-2">{variant.title}</h4>
                              <p className="text-sm text-slate-300 line-clamp-3 leading-relaxed">{variant.content}</p>
                           </button>
                        ))}
                     </div>
                     <div className="lg:col-span-7 space-y-8">
                        <div className="space-y-3">
                          <div className="flex justify-between items-center px-2">
                             <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Иллюстрация</label>
                             <button onClick={handleRegenerateImage} className="text-[10px] font-bold text-indigo-400 flex items-center gap-1.5 hover:underline">
                               <RefreshCw size={12}/> Обновить картинку
                             </button>
                          </div>
                          {selectedArticle.generatedImageUrl ? (
                            <img src={selectedArticle.generatedImageUrl} className="w-full rounded-[40px] border border-slate-800 shadow-2xl" alt="Preview" />
                          ) : (
                            <div className="w-full aspect-video bg-slate-900/50 rounded-[40px] border-2 border-dashed border-slate-800 flex flex-col items-center justify-center p-10 text-center">
                               {genError ? (
                                 <>
                                   <AlertTriangle size={32} className="text-amber-500 mb-4"/>
                                   <p className="text-xs text-amber-500 font-bold mb-2">Ошибка ИИ</p>
                                   <p className="text-[10px] text-slate-500 max-w-xs mb-6 truncate">{genError}</p>
                                   <button onClick={handleRegenerateImage} className="px-6 py-2 bg-slate-800 text-white rounded-xl text-[10px] font-bold">Повторить</button>
                                 </>
                               ) : (
                                 <>
                                   <ImageIconLucide size={32} className="text-slate-700 mb-4 animate-pulse"/>
                                   <p className="text-xs text-slate-500">Генерация...</p>
                                 </>
                               )}
                            </div>
                          )}
                        </div>
                        <div className="space-y-3">
                           <textarea 
                              value={editableText}
                              onChange={(e) => setEditableText(e.target.value)}
                              className="w-full min-h-[200px] p-8 bg-slate-900/50 rounded-[32px] border border-slate-800 text-slate-100 outline-none focus:border-indigo-500/50 transition-all resize-none"
                           />
                        </div>
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
                    <button onClick={() => handleDeploy(false)} className="w-full mt-8 py-5 bg-indigo-600 hover:bg-indigo-500 rounded-[24px] font-black text-white uppercase text-[10px] tracking-widest transition-all">Опубликовать</button>
                  ) : (
                    <button onClick={() => { setSelectedArticle(null); setDeployResults(null); refreshData(); }} className="w-full mt-8 py-5 bg-slate-800 hover:bg-slate-700 text-white rounded-[24px] font-black uppercase text-[10px]">Закрыть</button>
                  )}
               </div>
            </div>
         </div>
      )}

      {showDebugModal && (
        <div className="fixed inset-0 z-[200] bg-slate-950/95 backdrop-blur-2xl flex items-center justify-center p-6">
          <div className="glass w-full max-w-4xl p-10 rounded-[40px] border border-white/10 flex flex-col">
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-2xl font-black text-white">Логи API</h3>
              <button onClick={() => setShowDebugModal(null)}><XCircle size={32} className="text-slate-500"/></button>
            </div>
            <pre className="flex-1 bg-slate-900 p-6 rounded-3xl text-[10px] text-indigo-300 font-mono overflow-auto">
              {showDebugModal.request}
              {"\n\n--- RESPONSE ---\n\n"}
              {showDebugModal.response}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
