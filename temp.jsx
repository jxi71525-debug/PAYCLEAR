
        const { useState, useEffect, useRef, useMemo } = React;
        const { createClient } = window.supabase;

        const CURRENCY_SYMBOLS = {
            CNY: '¥', USD: '$', EUR: '€', GBP: '£', JPY: '¥', AUD: 'A$', CAD: 'C$', HKD: 'HK$', SGD: 'S$'
        };
        const CURRENCIES = Object.keys(CURRENCY_SYMBOLS);

        const CURRENCY_DETAILS = [
            { code: 'CNY', name: '人民币', countryCode: 'cn' },
            { code: 'USD', name: '美元', countryCode: 'us' },
            { code: 'AUD', name: '澳币', countryCode: 'au' },
            { code: 'HKD', name: '港币', countryCode: 'hk' },
            { code: 'EUR', name: '欧元', countryCode: 'eu' },
            { code: 'CAD', name: '加币', countryCode: 'ca' },
            { code: 'JPY', name: '日元', countryCode: 'jp' },
            { code: 'GBP', name: '英镑', countryCode: 'gb' },
            { code: 'SGD', name: '新加坡元', countryCode: 'sg' }
        ];

        const CATEGORIES = [
            { id: 'daily', name: '日常', icon: 'fa-star', color: 'bg-green-100 text-green-500' },
            { id: 'food', name: '餐饮', icon: 'fa-utensils', color: 'bg-orange-100 text-orange-500' },
            { id: 'transport', name: '交通', icon: 'fa-car', color: 'bg-blue-100 text-blue-500' },
            { id: 'housing', name: '住宿', icon: 'fa-bed', color: 'bg-indigo-100 text-indigo-500' },
            { id: 'tickets', name: '门票', icon: 'fa-ticket', color: 'bg-red-100 text-red-500' },
            { id: 'comm', name: '通讯', icon: 'fa-phone', color: 'bg-cyan-100 text-cyan-500' },
            { id: 'shopping', name: '购物', icon: 'fa-cart-shopping', color: 'bg-pink-100 text-pink-500' },
            { id: 'drinks', name: '酒水', icon: 'fa-wine-glass', color: 'bg-purple-100 text-purple-500' },
            { id: 'entertainment', name: '娱乐', icon: 'fa-gamepad', color: 'bg-yellow-100 text-yellow-500' },
            { id: 'medical', name: '医疗', icon: 'fa-hospital', color: 'bg-rose-100 text-rose-500' },
            { id: 'beauty', name: '美容', icon: 'fa-spa', color: 'bg-fuchsia-100 text-fuchsia-500' },
            { id: 'education', name: '教育', icon: 'fa-book', color: 'bg-sky-100 text-sky-500' },
            { id: 'investment', name: '投资', icon: 'fa-chart-line', color: 'bg-emerald-100 text-emerald-500' },
            { id: 'gifts', name: '礼物', icon: 'fa-gift', color: 'bg-red-100 text-red-400' },
            { id: 'pets', name: '宠物', icon: 'fa-paw', color: 'bg-amber-100 text-amber-500' }
        ];

        // Exchange Rate API Helper
        const fetchExchangeRate = async (from, to) => {
            if (from === to) return 1;
            try {
                const res = await fetch(`https://open.er-api.com/v6/latest/${from}`);
                const data = await res.json();
                return data.rates[to] || 1;
            } catch (e) {
                console.error("Exchange rate error:", e);
                return 1;
            }
        };

        // LocalStorage hook
        function useLocalStorage(key, initialValue) {
            const [storedValue, setStoredValue] = useState(() => {
                try {
                    const item = window.localStorage.getItem(key);
                    return item ? JSON.parse(item) : initialValue;
                } catch (error) {
                    return initialValue;
                }
            });

            const setValue = (value) => {
                try {
                    const valueToStore = value instanceof Function ? value(storedValue) : value;
                    setStoredValue(valueToStore);
                    window.localStorage.setItem(key, JSON.stringify(valueToStore));
                } catch (error) {
                    console.error(error);
                }
            };
            return [storedValue, setValue];
        }

        // Helper to get local date string YYYY-MM-DD
        const getTodayString = () => {
            const d = new Date();
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        };

        // Helpers for Bill Split Logic
        const getBillParticipantIds = (bill) => {
            if (!bill.participants || bill.participants.length === 0) return [];
            if (typeof bill.participants[0] === 'string') return bill.participants;
            return bill.participants.map(p => p.id);
        };

        const getBillShare = (bill, userId) => {
            if (!bill.participants || bill.participants.length === 0) return 0;
            if (typeof bill.participants[0] === 'string') {
                if (bill.participants.includes(userId)) {
                    return bill.amount / bill.participants.length;
                }
                return 0;
            } else {
                const p = bill.participants.find(p => p.id === userId);
                return p ? p.amount : 0;
            }
        };

        function App() {
            // ============================
            // Configuration & Auth
            // ============================
            // We try to use the cached config if available, otherwise fallback to hardcoded values.
            const cachedConfig = JSON.parse(window.localStorage.getItem('payclear_supabase_v2') || '{}');
            
            // 👉 为了免去每次输入的麻烦，你可以直接在这里把你的真实 URL 和 KEY 写死！
            const SUPABASE_URL = cachedConfig.url || 'https://yawgqzixeactmxxfkbhx.supabase.co';
            const SUPABASE_KEY = cachedConfig.key || 'sb_publishable_brIpO2FHi_A3kCdgb4qsuQ_X2R1b9Q7'; // <--- 将你的 key 粘贴在这里

            const supabase = useMemo(() => {
                if (SUPABASE_URL && SUPABASE_KEY && SUPABASE_KEY !== '请在这里填入你的_anon_key') {
                    try { return createClient(SUPABASE_URL, SUPABASE_KEY); } catch(e) { return null; }
                }
                return null;
            }, []);

            // User Identity
            const [currentUser, setCurrentUser] = useLocalStorage('payclear_user', null);
            const [showLogin, setShowLogin] = useState(false);
            const [loginMode, setLoginMode] = useState('login'); // 'login' or 'register'
            const [loginName, setLoginName] = useState('');
            const [loginPassword, setLoginPassword] = useState('');

            // ============================
            // Routing & Global State
            // ============================
            const urlParams = new URLSearchParams(window.location.search);
            const addFriendId = urlParams.get('add_friend');
            const joinGroupId = urlParams.get('join_group');

            // Dashboard State
            const [myGroups, setMyGroups] = useState([]);
            const [myFriends, setMyFriends] = useState([]);
            const [activeScreen, setActiveScreen] = useState('dashboard'); // 'dashboard', 'group', 'report'
            const [currentTab, setCurrentTab] = useState('home'); // 'home', 'contacts', 'profile'
            
            // Current Group State
            const [currentGroup, setCurrentGroup] = useState(null);
            const [groupMembers, setGroupMembers] = useState([]);
            const [bills, setBills] = useState([]);
            const [messages, setMessages] = useState([]);
            const [chatInput, setChatInput] = useState('');
            const chatScrollRef = useRef(null);

            // Smart Parser Suggestion
            const [smartSuggestion, setSmartSuggestion] = useState(null);

            // UI Modals
            const [showQRModal, setShowQRModal] = useState(false);
            const [showScannerModal, setShowScannerModal] = useState(false);
            const [showSearchUserModal, setShowSearchUserModal] = useState(false);
            const [searchUsername, setSearchUsername] = useState('');
            const [searchResults, setSearchResults] = useState([]); 
            const [searchStatus, setSearchStatus] = useState('idle'); // 'idle', 'searching', 'not_found', 'done'
            const [qrData, setQrData] = useState({ type: '', id: '' }); // type: 'friend' | 'group'
            const [showCreateGroup, setShowCreateGroup] = useState(false);
            const [newGroupName, setNewGroupName] = useState('');
            const [selectedFriendsForGroup, setSelectedFriendsForGroup] = useState([]);

            // Settle Up State
            const [showSettleModal, setShowSettleModal] = useState(false);
            const [settlements, setSettlements] = useState([]);

            // Toast State
            const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

            const showToast = (message, type = 'success') => {
                setToast({ show: true, message, type });
                setTimeout(() => setToast(prev => ({ ...prev, show: false })), 2500);
            };

            // ============================
            // Report Center State
            // ============================
            const [reportBills, setReportBills] = useState([]);
            const [reportTimeRange, setReportTimeRange] = useState('last_30_days'); // 'all', 'last_30_days', 'this_month', 'last_month', 'this_year', 'custom'
            const [customDateRange, setCustomDateRange] = useState({ start: '', end: '' });
            const trendChartRef = useRef(null);
            const categoryChartRef = useRef(null);

            // ============================
            // Add Expense State (New UI)
            // ============================
            const [showAddExpense, setShowAddExpense] = useState(false);
            const [isSubmittingExpense, setIsSubmittingExpense] = useState(false);
            const [editingBillId, setEditingBillId] = useState(null);
            const [expenseType, setExpenseType] = useState('out'); // 'out', 'in', 'transfer'
            const [amount, setAmount] = useState('0');
            const [currency, setCurrency] = useState('CNY');
            const [selectedCategory, setSelectedCategory] = useState('daily');
            const [payerId, setPayerId] = useState('');
            const [participants, setParticipants] = useState([]); // Array of user IDs
            const [splitType, setSplitType] = useState('equal'); // 'equal', 'exact', 'percent'
            const [splitAmounts, setSplitAmounts] = useState({}); // { [userId]: number_or_string }
            const [expenseDate, setExpenseDate] = useState(() => getTodayString()); // YYYY-MM-DD
            const qrRef = useRef(null);

            // Currency Modal State
            const [showCurrencyModal, setShowCurrencyModal] = useState(false);
            const [currencySearch, setCurrencySearch] = useState('');
            const [liveRates, setLiveRates] = useState({});

            const openCurrencyModal = async () => {
                setCurrencySearch('');
                setShowCurrencyModal(true);
                if (currentGroup) {
                    try {
                        const res = await fetch(`https://open.er-api.com/v6/latest/${currentGroup.main_currency}`);
                        const data = await res.json();
                        if (data && data.rates) {
                            const invertedRates = {};
                            Object.keys(data.rates).forEach(c => {
                                invertedRates[c] = 1 / data.rates[c];
                            });
                            setLiveRates(invertedRates);
                        }
                    } catch (e) {
                        console.error("Failed to fetch rates:", e);
                    }
                }
            };

            // ============================
            // Initialization & Auth Logic
            // ============================
            useEffect(() => {
                const verifyUser = async () => {
                    if (supabase && currentUser) {
                        const { data: validUser, error } = await supabase.from('users').select('id').eq('id', currentUser.id).maybeSingle();
                        if (!validUser) {
                            console.log("User no longer exists in DB. Logging out.");
                            setCurrentUser(null); // Clear local storage user
                            setShowLogin(true);
                            return;
                        }
                        fetchDashboardData();
                        handleUrlActions();
                    } else if (supabase && !currentUser) {
                        setShowLogin(true);
                    }
                };
                verifyUser();
            }, [supabase, currentUser]);

            const handleLoginSubmit = async (e) => {
                e.preventDefault();
                if (!loginName.trim() || !loginPassword.trim()) return;
                
                if (!supabase) {
                    showToast("未配置 Supabase 密钥，请在 index.html 第 142 行填入", "error");
                    return;
                }

                try {
                    const safeName = loginName.trim().replace(/[^\x00-\x7F]/g, encodeURIComponent);
                    
                    if (loginMode === 'login') {
                        const { data: existingUser, error: selectError } = await supabase.from('users').select('*').eq('name', loginName.trim()).maybeSingle();
                        if (selectError) throw selectError;
                        
                        if (!existingUser) {
                            showToast("账号不存在，请先注册", "error");
                            return;
                        }
                        
                        if (existingUser.password !== loginPassword) {
                            showToast("密码错误", "error");
                            return;
                        }
                        
                        // If it's a legacy user without a user_code, generate one for them
                        if (!existingUser.user_code) {
                            const newCode = Math.floor(100000 + Math.random() * 900000).toString();
                            const { error: updateError } = await supabase.from('users').update({ user_code: newCode }).eq('id', existingUser.id);
                            if (!updateError) {
                                existingUser.user_code = newCode;
                            }
                        }
                        
                        setCurrentUser(existingUser);
                        showToast("登录成功！");
                    } else {
                        // Register
                        const { data: existingUser } = await supabase.from('users').select('id').eq('name', loginName.trim()).maybeSingle();
                        if (existingUser) {
                            showToast("该用户名已被注册", "error");
                            return;
                        }
                        
                        // Generate a 6-digit random user code
                        const newCode = Math.floor(100000 + Math.random() * 900000).toString();
                        
                        const { data: newUser, error: insertError } = await supabase.from('users').insert({ 
                            name: loginName.trim(),
                            password: loginPassword,
                            user_code: newCode
                        }).select().single();
                        
                        if (insertError) throw insertError;
                        setCurrentUser(newUser);
                        showToast("注册成功！");
                    }
                    setShowLogin(false);
                } catch (err) {
                    console.error("Login Error:", err);
                    showToast("操作失败: 数据库异常", "error");
                }
            };

            const handleUrlActions = async () => {
                if (!currentUser || !supabase) return;

                // Handle Add Friend link
                if (addFriendId && addFriendId !== currentUser.id) {
                    // Check if already friends
                    const { data: existing } = await supabase.from('friendships')
                        .select('*')
                        .or(`and(user_id1.eq.${currentUser.id},user_id2.eq.${addFriendId}),and(user_id1.eq.${addFriendId},user_id2.eq.${currentUser.id})`);
                    
                    if (!existing || existing.length === 0) {
                        // Add friendship (always id1 < id2 to avoid duplicates)
                        const id1 = currentUser.id < addFriendId ? currentUser.id : addFriendId;
                        const id2 = currentUser.id < addFriendId ? addFriendId : currentUser.id;
                        const { error: insertError } = await supabase.from('friendships').insert({ user_id1: id1, user_id2: id2 });
                        
                        if (insertError) {
                            console.error("Insert Friend Error:", insertError);
                            showToast("添加失败: " + insertError.message, "error");
                        } else {
                            showToast('添加好友成功！');
                        }
                    } else {
                        showToast('你们已经是好友啦！', 'error');
                    }
                    // Remove param from URL without reloading
                    const url = new URL(window.location);
                    url.searchParams.delete('add_friend');
                    window.history.pushState({}, '', url);
                    
                    // Delay slightly to ensure Supabase replication lag doesn't cause a miss
                    setTimeout(fetchDashboardData, 500);
                }

                // Handle Join Group link
                if (joinGroupId) {
                    // Check if already in group
                    const { data: existing } = await supabase.from('group_members')
                        .select('*')
                        .eq('group_id', joinGroupId)
                        .eq('user_id', currentUser.id);
                    
                    if (!existing || existing.length === 0) {
                        await supabase.from('group_members').insert({ group_id: joinGroupId, user_id: currentUser.id });
                    }
                    window.history.pushState({}, '', window.location.pathname);
                    openGroup(joinGroupId);
                }
            };

            // ============================
            // Data Fetching
            // ============================
            const fetchDashboardData = async () => {
                if (!supabase || !currentUser) return;

                // Fetch Groups
                const { data: gmData } = await supabase.from('group_members').select('group_id').eq('user_id', currentUser.id);
                if (gmData && gmData.length > 0) {
                    const groupIds = gmData.map(g => g.group_id);
                    const { data: gData } = await supabase.from('groups').select('*').in('id', groupIds).order('created_at', { ascending: false });
                    setMyGroups(gData || []);
                } else {
                    setMyGroups([]);
                }

                // Fetch Friends
                const { data: fData1 } = await supabase.from('friendships').select('user_id2').eq('user_id1', currentUser.id);
                const { data: fData2 } = await supabase.from('friendships').select('user_id1').eq('user_id2', currentUser.id);
                
                let friendIds = [];
                if (fData1) friendIds = [...friendIds, ...fData1.map(f => f.user_id2)];
                if (fData2) friendIds = [...friendIds, ...fData2.map(f => f.user_id1)];

                if (friendIds.length > 0) {
                    const { data: uData } = await supabase.from('users').select('*').in('id', friendIds);
                    setMyFriends(uData || []);
                } else {
                    setMyFriends([]);
                }
            };

            const openGroup = async (groupId) => {
                if (!supabase) return;
                
                const { data: group } = await supabase.from('groups').select('*').eq('id', groupId).single();
                setCurrentGroup(group);

                const { data: gmData } = await supabase.from('group_members').select('user_id').eq('group_id', groupId);
                if (gmData) {
                    const userIds = gmData.map(g => g.user_id);
                    const { data: members } = await supabase.from('users').select('*').in('id', userIds);
                    setGroupMembers(members || []);
                }

                const { data: bData } = await supabase.from('bills').select('*').eq('group_id', groupId).order('created_at', { ascending: true });
                setBills(bData || []);

                const { data: mData } = await supabase.from('messages').select('*').eq('group_id', groupId).order('created_at', { ascending: true });
                setMessages(mData || []);

                setActiveScreen('group');
                
                // Set up realtime subscription for this group's messages and bills
                supabase.channel('public:group_updates')
                    .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `group_id=eq.${groupId}` }, (payload) => {
                        if (payload.eventType === 'INSERT') {
                            setMessages(prev => [...prev, payload.new]);
                            setTimeout(() => {
                                if (chatScrollRef.current) chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
                            }, 100);
                        }
                    })
                    .on('postgres_changes', { event: '*', schema: 'public', table: 'bills', filter: `group_id=eq.${groupId}` }, (payload) => {
                        if (payload.eventType === 'INSERT') {
                            setBills(prev => [...prev, payload.new]);
                            setTimeout(() => {
                                if (chatScrollRef.current) chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
                            }, 100);
                        }
                    })
                    .subscribe();
                    
                setTimeout(() => {
                    if (chatScrollRef.current) chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
                }, 300);
            };

            const openReportCenter = async () => {
                if (!supabase || !currentUser) return;
                
                // Fetch all groups user is in
                const { data: gmData } = await supabase.from('group_members').select('group_id').eq('user_id', currentUser.id);
                if (gmData && gmData.length > 0) {
                    const groupIds = gmData.map(g => g.group_id);
                    // Fetch all bills from these groups
                    const { data: allBills } = await supabase.from('bills').select('*').in('group_id', groupIds);
                    // Filter bills where user is a participant
                    const myBills = (allBills || []).filter(b => getBillParticipantIds(b).includes(currentUser.id));
                    setReportBills(myBills);
                } else {
                    setReportBills([]);
                }
                
                setActiveScreen('report');
            };

            // ============================
            // Actions
            // ============================
            // Smart NLP Parser for Chat
            const parseExpenseText = (text) => {
                const numMatch = text.match(/(\d+(\.\d+)?)/);
                if (!numMatch) return null;
                const amount = numMatch[1];
                
                let category = 'daily';
                if (/吃|喝|饭|餐|奶茶|咖啡|点心|外卖/.test(text)) category = 'food';
                else if (/车|打车|地铁|公交|机票|高铁|油/.test(text)) category = 'transport';
                else if (/房|酒店|住宿/.test(text)) category = 'housing';
                else if (/门票|玩|电影|ktv|密室/i.test(text)) category = 'entertainment';
                else if (/买|超市|淘宝|衣服|网购/.test(text)) category = 'shopping';
                
                return { amount, category };
            };

            const handleSendChat = async (e) => {
                e.preventDefault();
                const text = chatInput.trim();
                if (!text || !supabase || !currentGroup) return;

                setChatInput('');
                
                // Optimistic UI for chat message
                const tempId = Date.now().toString();
                const newMsg = {
                    id: tempId,
                    group_id: currentGroup.id,
                    user_id: currentUser.id,
                    content: text,
                    created_at: new Date().toISOString()
                };
                
                // Parse for smart suggestion
                const parsed = parseExpenseText(text);
                if (parsed) {
                    setSmartSuggestion({ ...parsed, triggerMsgId: tempId, text });
                } else {
                    setSmartSuggestion(null);
                }

                // Insert to DB
                await supabase.from('messages').insert({
                    group_id: currentGroup.id,
                    user_id: currentUser.id,
                    content: text
                });
            };

            const handleAcceptSmartSuggestion = () => {
                if (!smartSuggestion) return;
                openAddExpense();
                setAmount(smartSuggestion.amount);
                setSelectedCategory(smartSuggestion.category);
                setSmartSuggestion(null);
            };

            const handleMessageClick = (text, senderId) => {
                const parsed = parseExpenseText(text);
                if (parsed) {
                    openAddExpense();
                    setAmount(parsed.amount);
                    setSelectedCategory(parsed.category);
                    setPayerId(senderId);
                } else {
                    showToast("未检测到账单金额", "error");
                }
            };

            // ============================
            // Mini Games Hub
            // ============================
            const [showGameModal, setShowGameModal] = useState(false);
            const [gameMode, setGameMode] = useState('select'); // 'select', 'roulette', 'cards', 'dice'
            const [gameStatus, setGameStatus] = useState('idle'); // 'idle', 'playing', 'done'
            const [gameWinner, setGameWinner] = useState(null);
            const [gameData, setGameData] = useState({});

            const openGameModal = () => {
                setGameMode('select');
                setGameStatus('idle');
                setGameWinner(null);
                setGameData({});
                setShowGameModal(true);
            };

            const handleGameSettle = () => {
                if (gameWinner) {
                    openAddExpense();
                    setPayerId(gameWinner.id);
                    setShowGameModal(false);
                }
            };

            // Game 1: Roulette
            const initRoulette = () => {
                if (!groupMembers || groupMembers.length === 0) return;
                setGameStatus('playing');
                setGameWinner(null);
                let counter = 0;
                const interval = setInterval(() => {
                    const randomIdx = Math.floor(Math.random() * groupMembers.length);
                    setGameWinner(groupMembers[randomIdx]);
                    counter++;
                    if (counter >= 20) {
                        clearInterval(interval);
                        setGameStatus('done');
                    }
                }, 100);
            };

            // Game 2: Bomb Cards
            const initCards = () => {
                if (!groupMembers || groupMembers.length === 0) return;
                const shuffled = [...groupMembers].sort(() => Math.random() - 0.5);
                const bombIdx = Math.floor(Math.random() * shuffled.length);
                setGameData({ members: shuffled, bombIdx, flipped: [] });
                setGameStatus('playing');
                setGameWinner(null);
            };

            const handleCardClick = (idx) => {
                if (gameStatus !== 'playing' || gameData.flipped.includes(idx)) return;
                const newFlipped = [...gameData.flipped, idx];
                setGameData({ ...gameData, flipped: newFlipped });
                if (idx === gameData.bombIdx) {
                    setGameWinner(gameData.members[idx]);
                    setGameStatus('done');
                }
            };

            // Game 3: Lowest Dice
            const initDice = () => {
                if (!groupMembers || groupMembers.length === 0) return;
                setGameStatus('playing');
                setGameWinner(null);
                setGameData({ rolling: true, results: {} });
                
                let ticks = 0;
                const interval = setInterval(() => {
                    const tempResults = {};
                    groupMembers.forEach(m => tempResults[m.id] = Math.floor(Math.random() * 6) + 1);
                    setGameData({ rolling: true, results: tempResults });
                    ticks++;
                    if (ticks >= 15) {
                        clearInterval(interval);
                        let lowestScore = 7;
                        let losers = [];
                        Object.entries(tempResults).forEach(([uid, score]) => {
                            if (score < lowestScore) { lowestScore = score; losers = [uid]; }
                            else if (score === lowestScore) { losers.push(uid); }
                        });
                        const finalLoserId = losers[Math.floor(Math.random() * losers.length)];
                        const finalLoser = groupMembers.find(m => m.id === finalLoserId);
                        
                        setGameData({ rolling: false, results: tempResults, losers });
                        setGameWinner(finalLoser);
                        setGameStatus('done');
                    }
                }, 100);
            };

            const handleCreateGroupSubmit = async (e) => {
                e.preventDefault();
                if (!newGroupName.trim() || !supabase || !currentUser) return;

                // 1. Create Group
                const { data: group } = await supabase.from('groups').insert({ 
                    name: newGroupName.trim(), 
                    main_currency: 'CNY' 
                }).select().single();

                // 2. Add creator and selected friends to group
                const membersToInsert = [
                    { group_id: group.id, user_id: currentUser.id },
                    ...selectedFriendsForGroup.map(fid => ({ group_id: group.id, user_id: fid }))
                ];
                
                await supabase.from('group_members').insert(membersToInsert);

                setShowCreateGroup(false);
                setNewGroupName('');
                setSelectedFriendsForGroup([]);
                fetchDashboardData();
                openGroup(group.id);
            };

            const handleCalcInput = (val) => {
                if (amount === '0' && val !== '.' && val !== '+' && val !== '-') {
                    setAmount(val);
                } else {
                    // Prevent consecutive operators
                    const lastChar = amount.slice(-1);
                    if (['+', '-', '.'].includes(val) && ['+', '-', '.'].includes(lastChar)) {
                        return;
                    }
                    setAmount(prev => prev + val);
                }
            };

            const handleDeleteCalc = () => {
                if (amount.length > 1) {
                    setAmount(prev => prev.slice(0, -1));
                } else {
                    setAmount('0');
                }
            };

            const handleConfirmCalc = () => {
                try {
                    // Evaluate simple math expressions like 10+5
                    // eslint-disable-next-line no-eval
                    const result = eval(amount);
                    if (!isNaN(result) && isFinite(result)) {
                        setAmount(parseFloat(result.toFixed(2)).toString());
                    } else {
                        setAmount('0');
                    }
                } catch (e) {
                    setAmount('0');
                }
            };

            const openAddExpense = () => {
                setEditingBillId(null);
                setAmount('0');
                setPayerId(currentUser.id);
                setParticipants(groupMembers.map(m => m.id)); // Default split equally
                setSplitType('equal');
                setSplitAmounts({});
                setSelectedCategory('daily');
                setExpenseDate(getTodayString());
                setShowAddExpense(true);

                // Fetch live rates when opening expense modal so we can show real-time conversion
                if (currentGroup && Object.keys(liveRates).length === 0) {
                    fetch(`https://open.er-api.com/v6/latest/${currentGroup.main_currency}`)
                        .then(res => res.json())
                        .then(data => {
                            if (data && data.rates) {
                                const invertedRates = {};
                                Object.keys(data.rates).forEach(c => {
                                    invertedRates[c] = 1 / data.rates[c];
                                });
                                setLiveRates(invertedRates);
                            }
                        })
                        .catch(e => console.error("Failed to fetch rates:", e));
                }
            };

            const handleEditBill = (bill) => {
                setEditingBillId(bill.id);
                setAmount(bill.original_amount.toString());
                setCurrency(bill.original_currency);
                setPayerId(bill.payer_id);
                setSelectedCategory(bill.category);
                setExpenseDate(bill.date.replace(/\//g, '-'));
                
                const pIds = getBillParticipantIds(bill);
                setParticipants(pIds);
                
                if (bill.participants && bill.participants.length > 0 && typeof bill.participants[0] === 'object') {
                    // Check if it's exact or percent
                    // For simplicity, we just map it back to exact for now
                    setSplitType('exact');
                    const amounts = {};
                    bill.participants.forEach(p => amounts[p.id] = p.amount);
                    setSplitAmounts(amounts);
                } else {
                    setSplitType('equal');
                    setSplitAmounts({});
                }
                
                setShowAddExpense(true);
            };

            const handleSubmitExpense = async () => {
                if (!supabase || !currentGroup || !currentUser) return;
                const numAmount = parseFloat(amount);
                if (numAmount <= 0) return alert('请输入有效金额');
                if (participants.length === 0) return alert('请选择参与人');

                setIsSubmittingExpense(true);
                try {
                    const cat = CATEGORIES.find(c => c.id === selectedCategory) || CATEGORIES[0];
                    
                    // Use liveRates if available (especially if user edited it), otherwise fetch
                    let rate = 1;
                    if (currency !== currentGroup.main_currency) {
                        if (liveRates[currency]) {
                            rate = liveRates[currency];
                        } else {
                            rate = await fetchExchangeRate(currency, currentGroup.main_currency);
                        }
                    }
                    const finalAmount = numAmount * rate;
                    
                    let finalParticipants = participants;
                    if (splitType === 'exact') {
                        let totalSplit = 0;
                        finalParticipants = participants.map(id => {
                            const pAmount = parseFloat(splitAmounts[id] || 0);
                            totalSplit += pAmount;
                            return { id, amount: pAmount * rate }; // Convert to main currency
                        });
                        // Allow small rounding differences
                        if (Math.abs(totalSplit - numAmount) > 0.1) {
                            setIsSubmittingExpense(false);
                            return alert('分账总金额必须等于账单总金额');
                        }
                    } else if (splitType === 'percent') {
                        let totalPercent = 0;
                        finalParticipants = participants.map(id => {
                            const pPercent = parseFloat(splitAmounts[id] || 0);
                            totalPercent += pPercent;
                            return { id, amount: finalAmount * (pPercent / 100) };
                        });
                        if (Math.abs(totalPercent - 100) > 0.1) {
                            setIsSubmittingExpense(false);
                            return alert('分账总比例必须等于100%');
                        }
                    }

                    const billData = {
                        group_id: currentGroup.id,
                        category: selectedCategory,
                        description: cat.name,
                        amount: finalAmount,
                        original_amount: numAmount,
                        original_currency: currency,
                        payer_id: payerId,
                        participants: finalParticipants,
                        date: expenseDate.replace(/-/g, '/') // Format as YYYY/MM/DD
                    };

                    if (editingBillId) {
                        await supabase.from('bills').update(billData).eq('id', editingBillId);
                    } else {
                        await supabase.from('bills').insert(billData);
                    }
                    
                    setShowAddExpense(false);
                    openGroup(currentGroup.id); // Refresh bills
                } catch (error) {
                    console.error(error);
                    alert("保存账单失败");
                } finally {
                    setIsSubmittingExpense(false);
                }
            };

            const handleDeleteBill = async () => {
                if (!editingBillId || !supabase || !currentGroup) return;
                if (!confirm("确定要删除这笔账单吗？")) return;
                
                setIsSubmittingExpense(true);
                try {
                    await supabase.from('bills').delete().eq('id', editingBillId);
                    setShowAddExpense(false);
                    openGroup(currentGroup.id);
                } catch (e) {
                    console.error(e);
                    alert("删除失败");
                } finally {
                    setIsSubmittingExpense(false);
                }
            };

            const handleSettleUp = () => {
                if (!currentGroup || !groupMembers || !bills) return;
                
                const balances = {};
                groupMembers.forEach(m => balances[m.id] = { name: m.name, amount: 0 });

                bills.forEach(bill => {
                    if (balances[bill.payer_id]) balances[bill.payer_id].amount += bill.amount;
                    
                    const pIds = getBillParticipantIds(bill);
                    pIds.forEach(pid => {
                        if (balances[pid]) balances[pid].amount -= getBillShare(bill, pid);
                    });
                });

                const debtors = [];
                const creditors = [];
                Object.keys(balances).forEach(id => {
                    if (balances[id].amount < -0.01) debtors.push({ id, name: balances[id].name, amount: Math.abs(balances[id].amount) });
                    else if (balances[id].amount > 0.01) creditors.push({ id, name: balances[id].name, amount: balances[id].amount });
                });

                debtors.sort((a, b) => b.amount - a.amount);
                creditors.sort((a, b) => b.amount - a.amount);

                const results = [];
                let i = 0, j = 0;
                while (i < debtors.length && j < creditors.length) {
                    const debtor = debtors[i];
                    const creditor = creditors[j];
                    const settleAmount = Math.min(debtor.amount, creditor.amount);

                    results.push({
                        from: debtor.name,
                        to: creditor.name,
                        amount: settleAmount.toFixed(2)
                    });

                    debtor.amount -= settleAmount;
                    creditor.amount -= settleAmount;

                    if (debtor.amount < 0.01) i++;
                    if (creditor.amount < 0.01) j++;
                }

                setSettlements(results);
                setShowSettleModal(true);
            };

            const handleSearchUser = async (e) => {
                e.preventDefault();
                const term = searchUsername.trim();
                if (!term || !supabase) return;

                setSearchStatus('searching');
                setSearchResults([]);
                
                const { data: users, error } = await supabase.from('users')
                    .select('id, name, user_code')
                    .or(`name.eq."${term}",user_code.eq."${term}"`);
                
                if (users && users.length > 0) {
                    // Exclude self from search results
                    const others = users.filter(u => u.id !== currentUser.id);
                    if (others.length > 0) {
                        setSearchResults(others);
                        setSearchStatus('done');
                    } else {
                        setSearchStatus('not_found');
                    }
                } else {
                    setSearchStatus('not_found');
                }
            };

            const handleAddSearchedFriend = async (targetUser) => {
                if (!targetUser) return;

                // Check if already friends
                const { data: existing } = await supabase.from('friendships')
                    .select('*')
                    .or(`and(user_id1.eq.${currentUser.id},user_id2.eq.${targetUser.id}),and(user_id1.eq.${targetUser.id},user_id2.eq.${currentUser.id})`);
                
                if (!existing || existing.length === 0) {
                    const id1 = currentUser.id < targetUser.id ? currentUser.id : targetUser.id;
                    const id2 = currentUser.id < targetUser.id ? targetUser.id : currentUser.id;
                    const { error: insertError } = await supabase.from('friendships').insert({ user_id1: id1, user_id2: id2 });
                    
                    if (insertError) {
                        console.error("Insert Friend Error:", insertError);
                        showToast("添加失败: " + insertError.message, "error");
                    } else {
                        showToast('添加好友成功！');
                    }
                    
                    setShowSearchUserModal(false);
                    setSearchUsername('');
                    setSearchResults([]);
                    setSearchStatus('idle');
                    
                    // Delay slightly to ensure Supabase replication lag doesn't cause a miss
                    setTimeout(fetchDashboardData, 500);
                } else {
                    showToast('你们已经是好友啦！', 'error');
                }
            };

            // QR Code logic
            useEffect(() => {
                if (showQRModal && qrRef.current) {
                    qrRef.current.innerHTML = '';
                    
                    // If on localhost, use the actual LAN IP for mobile scanning
                    let host = window.location.host;
                    if (host.includes('localhost') || host.includes('127.0.0.1')) {
                        host = '192.168.10.116:8000'; // Replace with actual LAN IP
                    }
                    
                    const baseUrl = window.location.protocol + '//' + host + window.location.pathname;
                    const url = qrData.type === 'friend' 
                        ? `${baseUrl}?add_friend=${qrData.id}`
                        : `${baseUrl}?join_group=${qrData.id}`;

                    new QRCode(qrRef.current, {
                        text: url,
                        width: 200,
                        height: 200,
                        colorDark : "#000000",
                        colorLight : "#ffffff",
                        correctLevel : QRCode.CorrectLevel.H
                    });
                }
            }, [showQRModal, qrData]);

            // Scanner logic
            useEffect(() => {
                let html5QrcodeScanner = null;
                
                if (showScannerModal) {
                    // Check if browser supports camera (usually requires HTTPS)
                    if (window.isSecureContext === false) {
                        alert("扫描功能需要 HTTPS 安全连接或 localhost 环境才能调用摄像头。\n由于当前是在局域网 IP 访问，浏览器可能禁止了摄像头权限。");
                        setShowScannerModal(false);
                        return;
                    }

                    // Small delay to ensure DOM is ready
                    setTimeout(() => {
                        html5QrcodeScanner = new Html5QrcodeScanner(
                            "reader",
                            { fps: 10, qrbox: {width: 250, height: 250}, aspectRatio: 1.0 },
                            /* verbose= */ false
                        );
                        
                        html5QrcodeScanner.render((decodedText, decodedResult) => {
                            // Handle on success
                            console.log(`Scan result: ${decodedText}`);
                            html5QrcodeScanner.clear();
                            setShowScannerModal(false);
                            
                            // Check if it's our URL format
                            try {
                                const url = new URL(decodedText);
                                const addFriendParam = url.searchParams.get('add_friend');
                                const joinGroupParam = url.searchParams.get('join_group');
                                
                                if (addFriendParam) {
                                    window.location.href = decodedText;
                                } else if (joinGroupParam) {
                                    window.location.href = decodedText;
                                } else {
                                    alert('无效的二维码');
                                }
                            } catch (e) {
                                alert('无法识别的二维码格式');
                            }
                        }, (errorMessage) => {
                            // parse error, ignore
                        });
                    }, 100);
                }

                return () => {
                    if (html5QrcodeScanner) {
                        html5QrcodeScanner.clear().catch(e => console.error(e));
                    }
                };
            }, [showScannerModal]);

            // ECharts hook for Report Center
            useEffect(() => {
                if (activeScreen !== 'report') return;

                // 1. Filter bills based on time range
                const now = new Date();
                const filteredBills = reportBills.filter(bill => {
                    const bDate = new Date(bill.date);
                    if (reportTimeRange === 'this_month') {
                        return bDate.getMonth() === now.getMonth() && bDate.getFullYear() === now.getFullYear();
                    } else if (reportTimeRange === 'last_month') {
                        const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                        return bDate.getMonth() === lastMonth.getMonth() && bDate.getFullYear() === lastMonth.getFullYear();
                    } else if (reportTimeRange === 'last_30_days') {
                        const diffTime = Math.abs(now - bDate);
                        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
                        return diffDays <= 30;
                    } else if (reportTimeRange === 'this_year') {
                        return bDate.getFullYear() === now.getFullYear();
                    } else if (reportTimeRange === 'custom') {
                        if (!customDateRange.start && !customDateRange.end) return true;
                        let isValid = true;
                        if (customDateRange.start) {
                            const start = new Date(customDateRange.start);
                            start.setHours(0, 0, 0, 0);
                            if (bDate < start) isValid = false;
                        }
                        if (customDateRange.end) {
                            const end = new Date(customDateRange.end);
                            end.setHours(23, 59, 59, 999);
                            if (bDate > end) isValid = false;
                        }
                        return isValid;
                    }
                    return true; // 'all'
                });

                // Calculate total expense (only my share)
                let totalExpense = 0;
                const categoryMap = {};
                const dateMap = {};

                filteredBills.forEach(bill => {
                    // My personal share
                    const myShare = getBillShare(bill, currentUser.id);
                    totalExpense += myShare;

                    // Aggregate by Category
                    categoryMap[bill.category] = (categoryMap[bill.category] || 0) + myShare;

                    // Aggregate by Date for Trend
                    dateMap[bill.date] = (dateMap[bill.date] || 0) + myShare;
                });

                // Prepare Category Data
                const pieData = Object.keys(categoryMap).map(catId => {
                    const catObj = CATEGORIES.find(c => c.id === catId) || CATEGORIES[0];
                    // extract hex color from tailwind class roughly or use default ECharts palette
                    const colorMap = {
                        'daily': '#22c55e', 'food': '#f97316', 'transport': '#3b82f6', 
                        'housing': '#6366f1', 'tickets': '#ef4444', 'comm': '#06b6d4', 
                        'shopping': '#ec4899', 'drinks': '#a855f7', 'entertainment': '#eab308',
                        'medical': '#f43f5e', 'beauty': '#d946ef', 'education': '#0ea5e9',
                        'investment': '#10b981', 'gifts': '#f87171', 'pets': '#f59e0b'
                    };
                    return { 
                        name: catObj.name, 
                        value: categoryMap[catId].toFixed(2),
                        itemStyle: { color: colorMap[catId] || '#43b5e4' }
                    };
                }).sort((a, b) => b.value - a.value);

                // Prepare Trend Data (sort by date)
                const sortedDates = Object.keys(dateMap).sort((a, b) => new Date(a) - new Date(b));
                const trendValues = sortedDates.map(d => dateMap[d].toFixed(2));

                // Initialize ECharts
                let trendChart, categoryChart;
                
                setTimeout(() => {
                    if (trendChartRef.current && window.echarts) {
                        trendChart = window.echarts.init(trendChartRef.current);
                        
                        // If there's only one data point, add some empty padding points so it doesn't look like a single dot in the middle of nowhere
                        let chartDates = [...sortedDates];
                        let chartValues = [...trendValues];
                        
                        if (chartDates.length === 1) {
                            const onlyDate = new Date(chartDates[0]);
                            const prevDate = new Date(onlyDate); prevDate.setDate(prevDate.getDate() - 1);
                            const nextDate = new Date(onlyDate); nextDate.setDate(nextDate.getDate() + 1);
                            
                            const formatDt = (d) => `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}`;
                            
                            chartDates = [formatDt(prevDate), chartDates[0], formatDt(nextDate)];
                            chartValues = [0, chartValues[0], 0];
                        } else if (chartDates.length === 0) {
                            chartDates = ['无数据'];
                            chartValues = [0];
                        }

                        trendChart.setOption({
                            tooltip: { 
                                trigger: 'axis', 
                                formatter: '{b}<br/>支出: ¥{c}',
                                backgroundColor: 'rgba(255, 255, 255, 0.9)',
                                borderColor: '#e5e7eb',
                                textStyle: { color: '#374151' }
                            },
                            grid: { left: '2%', right: '5%', bottom: '5%', top: '15%', containLabel: true },
                            xAxis: { 
                                type: 'category', 
                                boundaryGap: true, 
                                data: chartDates, 
                                axisLine: { lineStyle: { color: '#e5e7eb' } }, 
                                axisTick: { show: false }, 
                                axisLabel: { color: '#6b7280', fontSize: 10, margin: 12 } 
                            },
                            yAxis: { 
                                type: 'value', 
                                show: true,
                                splitLine: { lineStyle: { color: '#f3f4f6', type: 'dashed' } },
                                axisLabel: { color: '#9ca3af', fontSize: 10, formatter: '¥{value}' }
                            },
                            series: [{
                                data: chartValues,
                                type: chartDates.length === 3 && chartValues[1] > 0 && chartValues[0] === 0 ? 'bar' : 'line', // Use bar if it's artificially padded single point, otherwise line
                                barMaxWidth: 30,
                                smooth: true,
                                symbol: 'circle',
                                symbolSize: 8,
                                label: {
                                    show: true,
                                    position: 'top',
                                    formatter: '¥{c}',
                                    color: '#0284c7',
                                    fontSize: 10,
                                    distance: 5
                                },
                                itemStyle: { color: '#43b5e4' },
                                areaStyle: {
                                    color: new window.echarts.graphic.LinearGradient(0, 0, 0, 1, [
                                        { offset: 0, color: 'rgba(67, 181, 228, 0.4)' },
                                        { offset: 1, color: 'rgba(67, 181, 228, 0.05)' }
                                    ])
                                }
                            }]
                        });
                    }

                    if (categoryChartRef.current && window.echarts) {
                        categoryChart = window.echarts.init(categoryChartRef.current);
                        categoryChart.setOption({
                            tooltip: { trigger: 'item', formatter: '{b}: ¥{c} ({d}%)' },
                            series: [{
                                type: 'pie',
                                radius: ['40%', '70%'], // Slightly smaller to make room for labels
                                center: ['50%', '50%'],
                                avoidLabelOverlap: true,
                                itemStyle: { borderRadius: 8, borderColor: '#fff', borderWidth: 2 },
                                label: { 
                                    show: true, 
                                    position: 'outside',
                                    formatter: '{b}\n{d}%', // Category name and percentage
                                    fontSize: 11,
                                    fontWeight: 'bold',
                                    color: '#4b5563',
                                    lineHeight: 14
                                },
                                labelLine: { 
                                    show: true,
                                    length: 10,
                                    length2: 15,
                                    smooth: true
                                },
                                emphasis: { 
                                    itemStyle: { shadowBlur: 10, shadowOffsetX: 0, shadowColor: 'rgba(0, 0, 0, 0.5)' }
                                },
                                data: pieData.length > 0 ? pieData : [{ name: '无记录', value: 0, itemStyle: { color: '#e5e7eb' }, label: { show: false }, labelLine: { show: false } }]
                            }]
                        });
                    }
                }, 100);

                const handleResize = () => {
                    trendChart && trendChart.resize();
                    categoryChart && categoryChart.resize();
                };
                window.addEventListener('resize', handleResize);

                return () => {
                    window.removeEventListener('resize', handleResize);
                    trendChart && trendChart.dispose();
                    categoryChart && categoryChart.dispose();
                };

            }, [activeScreen, reportTimeRange, reportBills, customDateRange]);

            // ============================
            // Render Components
            // ============================

            if (showLogin || !currentUser) {
                return (
                    <div className="max-w-md mx-auto min-h-[100dvh] bg-secondary flex flex-col justify-center p-6 animate-fade-in relative">
                        {/* Toast Notification for Login */}
                        {toast.show && (
                            <div className="fixed top-4 left-1/2 z-[100] toast-enter w-[90%] max-w-sm">
                                <div className={`px-4 py-3 rounded-xl shadow-float flex items-center gap-3 ${toast.type === 'success' ? 'bg-white text-textMain' : 'bg-red-50 text-red-500'}`}>
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white shrink-0 ${toast.type === 'success' ? 'bg-green-500' : 'bg-red-500'}`}>
                                        <i className={`fa-solid ${toast.type === 'success' ? 'fa-check' : 'fa-xmark'}`}></i>
                                    </div>
                                    <span className="font-bold text-sm">{toast.message}</span>
                                </div>
                            </div>
                        )}

                        <div className="w-20 h-20 bg-white rounded-[2rem] shadow-float flex items-center justify-center text-primary mb-8 mx-auto">
                            <i className="fa-solid fa-wallet text-4xl"></i>
                        </div>
                        <h1 className="text-3xl font-bold text-center mb-8">PayClear</h1>
                        
                        <div className="flex justify-center gap-4 mb-6">
                            <button className={`pb-2 font-bold ${loginMode === 'login' ? 'text-primary border-b-2 border-primary' : 'text-textSub border-b-2 border-transparent'}`} onClick={() => setLoginMode('login')}>登录</button>
                            <button className={`pb-2 font-bold ${loginMode === 'register' ? 'text-primary border-b-2 border-primary' : 'text-textSub border-b-2 border-transparent'}`} onClick={() => setLoginMode('register')}>注册</button>
                        </div>

                        <form onSubmit={handleLoginSubmit} className="space-y-4 bg-white p-6 rounded-2xl shadow-soft">
                            <div>
                                <label className="block text-sm font-bold text-textSub mb-2">你的名字 / 昵称</label>
                                <input type="text" value={loginName} onChange={e => setLoginName(e.target.value)} className="w-full p-4 bg-secondary rounded-xl font-medium" placeholder="例如：Alice" required />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-textSub mb-2">密码</label>
                                <input type="password" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} className="w-full p-4 bg-secondary rounded-xl font-medium" placeholder="输入密码" required />
                            </div>
                            <button type="submit" className="w-full bg-primary text-white font-bold py-4 rounded-xl shadow-float active:scale-95 transition-all mt-4">
                                {loginMode === 'login' ? '进入系统' : '创建账号'}
                            </button>
                        </form>
                    </div>
                );
            }

            // --- Screen: Report Center ---
            if (activeScreen === 'report') {
                const now = new Date();
                const filteredBills = reportBills.filter(bill => {
                    const bDate = new Date(bill.date);
                    if (reportTimeRange === 'this_month') return bDate.getMonth() === now.getMonth() && bDate.getFullYear() === now.getFullYear();
                    if (reportTimeRange === 'last_month') {
                        const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                        return bDate.getMonth() === lastMonth.getMonth() && bDate.getFullYear() === lastMonth.getFullYear();
                    }
                    if (reportTimeRange === 'last_30_days') {
                        const diffTime = Math.abs(now - bDate);
                        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
                        return diffDays <= 30;
                    }
                    if (reportTimeRange === 'this_year') return bDate.getFullYear() === now.getFullYear();
                    if (reportTimeRange === 'custom') {
                        if (!customDateRange.start && !customDateRange.end) return true;
                        let isValid = true;
                        if (customDateRange.start) {
                            const start = new Date(customDateRange.start);
                            start.setHours(0, 0, 0, 0);
                            if (bDate < start) isValid = false;
                        }
                        if (customDateRange.end) {
                            const end = new Date(customDateRange.end);
                            end.setHours(23, 59, 59, 999);
                            if (bDate > end) isValid = false;
                        }
                        return isValid;
                    }
                    return true;
                });

                let totalExpense = 0;
                const categoryMap = {};
                filteredBills.forEach(bill => {
                    const myShare = getBillShare(bill, currentUser.id);
                    totalExpense += myShare;
                    categoryMap[bill.category] = (categoryMap[bill.category] || 0) + myShare;
                });

                const sortedCategories = Object.keys(categoryMap)
                    .map(catId => ({
                        catId,
                        amount: categoryMap[catId],
                        percent: ((categoryMap[catId] / totalExpense) * 100).toFixed(1)
                    }))
                    .sort((a, b) => b.amount - a.amount);

                return (
                    <div className="flex flex-col h-full bg-[#f6f6f6] animate-fade-in">
                        {/* Header (Blue Gradient) */}
                        <div className="bg-gradient-to-b from-[#43b5e4] to-[#2ca0d6] text-white pt-safe">
                            <div className="flex items-center justify-between p-4">
                                <button onClick={() => setActiveScreen('dashboard')} className="w-10 h-10 flex items-center justify-center -ml-2 active:scale-90 transition-transform">
                                    <i className="fa-solid fa-angle-left text-2xl"></i>
                                </button>
                                <div className="font-bold text-xl flex items-center gap-2">
                                    <i className="fa-solid fa-chart-simple"></i> 个人报表
                                </div>
                                <div className="w-10"></div>
                            </div>
                            
                            {/* Time Filters */}
                            <div className="flex overflow-x-auto no-scrollbar gap-6 px-4 pb-2 text-sm font-medium text-white/70">
                                {[
                                    { id: 'all', label: '全部时间' },
                                    { id: 'last_30_days', label: '最近三十天' },
                                    { id: 'this_year', label: '今年' },
                                    { id: 'this_month', label: '本月' },
                                    { id: 'last_month', label: '上月' },
                                    { id: 'custom', label: '自定义' }
                                ].map(tab => (
                                    <button 
                                        key={tab.id}
                                        onClick={() => {
                                            setReportTimeRange(tab.id);
                                            setTimeout(() => window.dispatchEvent(new Event('resize')), 50);
                                        }}
                                        className={`whitespace-nowrap pb-2 transition-colors relative ${reportTimeRange === tab.id ? 'text-white font-bold' : 'hover:text-white/90'}`}
                                    >
                                        {tab.label}
                                        {reportTimeRange === tab.id && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-white rounded-full"></div>}
                                    </button>
                                ))}
                            </div>
                            
                            {/* Custom Date Range Picker */}
                            {reportTimeRange === 'custom' && (
                                <div className="px-4 pb-4 flex items-center justify-between gap-2 text-sm text-white animate-fade-in">
                                    <input 
                                        type="date" 
                                        value={customDateRange.start}
                                        onChange={e => setCustomDateRange({...customDateRange, start: e.target.value})}
                                        className="bg-white/20 border border-white/30 rounded-lg px-3 py-1.5 outline-none flex-1 [color-scheme:dark]"
                                    />
                                    <span className="font-bold">至</span>
                                    <input 
                                        type="date" 
                                        value={customDateRange.end}
                                        onChange={e => setCustomDateRange({...customDateRange, end: e.target.value})}
                                        className="bg-white/20 border border-white/30 rounded-lg px-3 py-1.5 outline-none flex-1 [color-scheme:dark]"
                                    />
                                </div>
                            )}
                        </div>

                        <div className="flex-1 overflow-y-auto pb-safe">
                            {/* Total Summary */}
                            <div className="bg-white p-6 text-center shadow-sm mb-2">
                                <div className="text-gray-500 text-sm mb-1">个人总支出</div>
                                <div className="text-4xl font-bold text-[#1f2937] flex items-center justify-center gap-1">
                                    <span className="text-2xl">¥</span>{totalExpense.toFixed(2)}
                                </div>
                            </div>

                            {/* Trend Chart */}
                            <div className="bg-white p-4 shadow-sm mb-2">
                                <div className="flex items-center gap-2 font-bold text-lg mb-4">
                                    收支趋势 <span className="text-xs font-normal bg-[#e0f2fe] text-[#0284c7] px-2 py-1 rounded-full">支出</span>
                                </div>
                                <div ref={trendChartRef} className="w-full h-[200px]"></div>
                            </div>

                            {/* Category Chart */}
                            <div className="bg-white p-4 shadow-sm min-h-[400px]">
                                <div className="flex items-center justify-between font-bold text-lg mb-2">
                                    <span>支出分类比</span>
                                    <span className="text-sm font-normal text-gray-500">共 ¥{totalExpense.toFixed(2)}</span>
                                </div>
                                
                                {/* ECharts Pie */}
                                <div ref={categoryChartRef} className="w-full h-[250px] mb-4"></div>

                                {/* Category List */}
                                <div className="space-y-3">
                                    <div className="text-sm text-gray-400 mb-2 border-b pb-2">百分比从大到小</div>
                                    {sortedCategories.length === 0 ? (
                                        <div className="text-center text-gray-400 py-4">暂无数据</div>
                                    ) : (
                                        sortedCategories.map((item, idx) => {
                                            const catObj = CATEGORIES.find(c => c.id === item.catId) || CATEGORIES[0];
                                            return (
                                                <div key={item.catId} className="flex items-center justify-between">
                                                    <div className="flex items-center gap-3">
                                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${catObj.color}`}>
                                                            <i className={`fa-solid ${catObj.icon}`}></i>
                                                        </div>
                                                        <div>
                                                            <div className="text-sm font-bold text-textMain">{catObj.name}</div>
                                                            <div className="text-xs text-textSub">{item.percent}%</div>
                                                        </div>
                                                    </div>
                                                    <div className="font-bold text-textMain">¥{item.amount.toFixed(2)}</div>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                );
            }

            // --- Screen: Dashboard (Tabs) ---
            if (activeScreen === 'dashboard') {
                return (
                    <div className="flex flex-col h-full bg-[#f6f7f9] animate-fade-in relative">
                        {/* Tab: Home (Groups) */}
                        {currentTab === 'home' && (
                            <div className="flex-1 overflow-y-auto pb-24">
                                <div className="glass-header sticky top-0 z-10 px-5 pt-safe pb-3">
                                    <div className="flex items-center justify-between mt-4">
                                        <h1 className="text-2xl font-bold text-textMain">消息</h1>
                                        <div className="flex gap-4 text-textMain text-xl">
                                            <button onClick={() => setShowScannerModal(true)} className="active:scale-90 transition-transform"><i className="fa-solid fa-qrcode"></i></button>
                                            <button onClick={() => setShowCreateGroup(true)} className="active:scale-90 transition-transform"><i className="fa-solid fa-circle-plus"></i></button>
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="p-4 space-y-4">
                                    {/* Search Bar */}
                                    <div className="bg-white rounded-xl px-4 py-3 flex items-center gap-3 card-shadow">
                                        <i className="fa-solid fa-magnifying-glass text-gray-400"></i>
                                        <input type="text" placeholder="搜索群组..." className="bg-transparent border-none outline-none w-full text-sm font-medium" />
                                    </div>

                                    {myGroups.length === 0 ? (
                                        <div className="text-center py-20 text-textSub">
                                            <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto mb-4 card-shadow">
                                                <i className="fa-solid fa-comments text-3xl text-gray-300"></i>
                                            </div>
                                            <p className="font-medium text-sm">暂无群组</p>
                                            <p className="text-xs mt-1">点击右上角 + 创建一个吧</p>
                                        </div>
                                    ) : (
                                        <div className="bg-white rounded-2xl overflow-hidden card-shadow">
                                            {myGroups.map((g, idx) => (
                                                <div 
                                                    key={g.id} 
                                                    onClick={() => openGroup(g.id)} 
                                                    className={`flex items-center p-4 cursor-pointer active:bg-gray-50 transition-colors ${idx !== myGroups.length - 1 ? 'border-b border-gray-50' : ''}`}
                                                >
                                                    <div className="w-12 h-12 bg-gradient-to-br from-primaryLight to-primary rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-sm shrink-0">
                                                        {g.name.substring(0, 2)}
                                                    </div>
                                                    <div className="ml-4 flex-1 overflow-hidden">
                                                        <div className="flex justify-between items-center mb-1">
                                                            <h3 className="font-bold text-textMain truncate">{g.name}</h3>
                                                            <span className="text-xs text-textSub whitespace-nowrap">刚刚</span>
                                                        </div>
                                                        <p className="text-sm text-textSub truncate">点击进入账单流...</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Tab: Contacts (Friends) */}
                        {currentTab === 'contacts' && (
                            <div className="flex-1 overflow-y-auto pb-24">
                                <div className="glass-header sticky top-0 z-10 px-5 pt-safe pb-3">
                                    <div className="flex items-center justify-between mt-4">
                                        <h1 className="text-2xl font-bold text-textMain">通讯录</h1>
                                        <button onClick={() => setShowSearchUserModal(true)} className="text-textMain text-xl active:scale-90 transition-transform">
                                            <i className="fa-solid fa-user-plus"></i>
                                        </button>
                                    </div>
                                </div>

                                <div className="p-4 space-y-4">
                                    <div className="bg-white rounded-2xl overflow-hidden card-shadow">
                                        <div className="flex items-center p-4 cursor-pointer active:bg-gray-50 transition-colors border-b border-gray-50" onClick={() => setShowSearchUserModal(true)}>
                                            <div className="w-10 h-10 bg-orange-400 rounded-xl flex items-center justify-center text-white shrink-0">
                                                <i className="fa-solid fa-user-plus"></i>
                                            </div>
                                            <span className="ml-4 font-bold text-textMain">新的朋友</span>
                                        </div>
                                        <div className="flex items-center p-4 cursor-pointer active:bg-gray-50 transition-colors">
                                            <div className="w-10 h-10 bg-green-500 rounded-xl flex items-center justify-center text-white shrink-0">
                                                <i className="fa-solid fa-users"></i>
                                            </div>
                                            <span className="ml-4 font-bold text-textMain">群聊</span>
                                        </div>
                                    </div>

                                    <div className="text-xs font-bold text-textSub px-2">我的好友 ({myFriends.length})</div>
                                    <div className="bg-white rounded-2xl overflow-hidden card-shadow">
                                        {myFriends.length === 0 ? (
                                            <div className="text-center py-10 text-textSub text-sm">
                                                暂无好友，快去添加吧
                                            </div>
                                        ) : (
                                            myFriends.map((f, idx) => (
                                                <div key={f.id} className={`flex items-center p-4 ${idx !== myFriends.length - 1 ? 'border-b border-gray-50' : ''}`}>
                                                    <div className="w-10 h-10 bg-gray-200 rounded-xl flex items-center justify-center font-bold text-gray-500 shrink-0">
                                                        {f.name.charAt(0)}
                                                    </div>
                                                    <span className="ml-4 font-bold text-textMain">{f.name}</span>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Tab: Profile (Me) */}
                        {currentTab === 'profile' && (
                            <div className="flex-1 overflow-y-auto pb-24">
                                <div className="bg-white pb-6 pt-safe card-shadow">
                                    <div className="px-6 mt-6 flex items-center justify-between">
                                        <div className="flex items-center gap-5">
                                            <div className="w-16 h-16 bg-gradient-to-tr from-primary to-blue-600 rounded-2xl shadow-md flex items-center justify-center text-white text-2xl font-bold">
                                                {currentUser.name.charAt(0)}
                                            </div>
                                            <div>
                                                <h2 className="text-2xl font-bold text-textMain">{currentUser.name}</h2>
                                                <p className="text-sm text-textSub mt-1 font-medium">PayClear ID: {currentUser.user_code || '暂无'}</p>
                                            </div>
                                        </div>
                                        <button onClick={() => { setQrData({ type: 'friend', id: currentUser.id }); setShowQRModal(true); }} className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-textMain active:scale-90 transition-transform">
                                            <i className="fa-solid fa-qrcode text-lg"></i>
                                        </button>
                                    </div>
                                </div>

                                <div className="p-4 mt-2 space-y-4">
                                    <div className="bg-white rounded-2xl overflow-hidden card-shadow">
                                        <div className="flex items-center p-4 cursor-pointer active:bg-gray-50 transition-colors" onClick={() => setActiveScreen('report')}>
                                            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-500 shrink-0">
                                                <i className="fa-solid fa-chart-pie"></i>
                                            </div>
                                            <span className="ml-4 font-bold text-textMain flex-1">报表中心</span>
                                            <i className="fa-solid fa-angle-right text-gray-300"></i>
                                        </div>
                                    </div>

                                    <div className="bg-white rounded-2xl overflow-hidden card-shadow">
                                        <div className="flex items-center p-4 cursor-pointer active:bg-gray-50 transition-colors border-b border-gray-50">
                                            <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 shrink-0">
                                                <i className="fa-solid fa-gear"></i>
                                            </div>
                                            <span className="ml-4 font-bold text-textMain flex-1">设置</span>
                                            <i className="fa-solid fa-angle-right text-gray-300"></i>
                                        </div>
                                        <div className="flex items-center p-4 cursor-pointer active:bg-gray-50 transition-colors" onClick={() => {
                                            if (confirm("确定要退出登录吗？")) {
                                                setCurrentUser(null);
                                                setShowLogin(true);
                                            }
                                        }}>
                                            <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center text-red-500 shrink-0">
                                                <i className="fa-solid fa-arrow-right-from-bracket"></i>
                                            </div>
                                            <span className="ml-4 font-bold text-red-500 flex-1">退出登录</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Bottom Tab Bar */}
                        <div className="glass-tabbar fixed bottom-0 left-0 w-full z-20 flex justify-around items-center pt-3">
                            <button onClick={() => setCurrentTab('home')} className={`flex flex-col items-center gap-1 w-1/3 ${currentTab === 'home' ? 'text-primary' : 'text-gray-400'}`}>
                                <i className={`text-xl ${currentTab === 'home' ? 'fa-solid fa-comment-dots' : 'fa-regular fa-comment-dots'}`}></i>
                                <span className="text-[10px] font-bold">消息</span>
                            </button>
                            <button onClick={() => setCurrentTab('contacts')} className={`flex flex-col items-center gap-1 w-1/3 ${currentTab === 'contacts' ? 'text-primary' : 'text-gray-400'}`}>
                                <i className={`text-xl ${currentTab === 'contacts' ? 'fa-solid fa-address-book' : 'fa-regular fa-address-book'}`}></i>
                                <span className="text-[10px] font-bold">通讯录</span>
                            </button>
                            <button onClick={() => setCurrentTab('profile')} className={`flex flex-col items-center gap-1 w-1/3 ${currentTab === 'profile' ? 'text-primary' : 'text-gray-400'}`}>
                                <i className={`text-xl ${currentTab === 'profile' ? 'fa-solid fa-user' : 'fa-regular fa-user'}`}></i>
                                <span className="text-[10px] font-bold">我</span>
                            </button>
                        </div>

                        {/* Modals for Dashboard */}
                        {showCreateGroup && (
                            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 animate-fade-in" onClick={() => setShowCreateGroup(false)}>
                                <div className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl p-6 pb-safe shadow-2xl" onClick={e => e.stopPropagation()}>
                                    <div className="flex justify-between items-center mb-6">
                                        <h3 className="text-xl font-bold">发起群收款</h3>
                                        <button onClick={() => setShowCreateGroup(false)} className="text-gray-400 hover:text-textMain"><i className="fa-solid fa-xmark text-xl"></i></button>
                                    </div>
                                    <form onSubmit={handleCreateGroupSubmit}>
                                        <div className="mb-6">
                                            <label className="block text-sm font-bold text-textSub mb-2">群组名称</label>
                                            <input type="text" value={newGroupName} onChange={e => setNewGroupName(e.target.value)} className="w-full p-4 bg-secondary rounded-xl font-medium" placeholder="例如：周末聚餐" required />
                                        </div>
                                        <div className="mb-8">
                                            <label className="block text-sm font-bold text-textSub mb-2">选择参与的好友</label>
                                            <div className="flex flex-wrap gap-2">
                                                {myFriends.map(friend => (
                                                    <button key={friend.id} type="button" 
                                                        onClick={() => {
                                                            if (selectedFriendsForGroup.includes(friend.id)) setSelectedFriendsForGroup(prev => prev.filter(id => id !== friend.id));
                                                            else setSelectedFriendsForGroup([...selectedFriendsForGroup, friend.id]);
                                                        }}
                                                        className={`px-4 py-2 rounded-full text-sm font-medium transition-all flex items-center ${selectedFriendsForGroup.includes(friend.id) ? 'bg-primary/10 text-primary border border-primary/20' : 'bg-secondary text-textSub border border-transparent'}`}>
                                                        {selectedFriendsForGroup.includes(friend.id) && <i className="fa-solid fa-check mr-1.5 text-xs"></i>}
                                                        {friend.name}
                                                    </button>
                                                ))}
                                                {myFriends.length === 0 && <span className="text-xs text-textSub py-2">请先在通讯录添加好友</span>}
                                            </div>
                                        </div>
                                        <button type="submit" className="w-full bg-primary text-white font-bold py-4 rounded-xl shadow-float active:scale-95">创建群组</button>
                                    </form>
                                </div>
                            </div>
                        )}

                        {showQRModal && (
                            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in" onClick={() => setShowQRModal(false)}>
                                <div className="bg-white rounded-3xl p-8 max-w-[300px] w-full text-center shadow-2xl" onClick={e => e.stopPropagation()}>
                                    <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center text-primary mx-auto mb-4">
                                        <i className={`fa-solid ${qrData.type === 'friend' ? 'fa-user-plus' : 'fa-users'} text-xl`}></i>
                                    </div>
                                    <h3 className="text-xl font-bold text-textMain mb-1">{qrData.type === 'friend' ? '扫码加我为好友' : '扫码加入群组'}</h3>
                                    <p className="text-sm text-textSub mb-6">让朋友扫描此二维码即可</p>
                                    <div className="bg-secondary p-4 rounded-2xl flex justify-center mb-6">
                                        <div id="qrcode" ref={qrRef}></div>
                                    </div>
                                    <button onClick={() => setShowQRModal(false)} className="w-full py-3.5 bg-secondary text-textMain font-bold rounded-xl active:scale-95">关闭</button>
                                </div>
                            </div>
                        )}

                        {/* Scanner Modal */}
                        {showScannerModal && (
                            <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex flex-col z-50 animate-fade-in">
                                <div className="flex justify-between items-center p-6 text-white">
                                    <h3 className="text-xl font-bold">扫描二维码</h3>
                                    <button onClick={() => setShowScannerModal(false)} className="text-white/70 hover:text-white"><i className="fa-solid fa-xmark text-2xl"></i></button>
                                </div>
                                <div className="flex-1 flex flex-col items-center justify-center p-4">
                                    <div className="w-full max-w-sm bg-black rounded-2xl overflow-hidden border-2 border-primary/50 shadow-[0_0_30px_rgba(67,181,228,0.3)] relative">
                                        <div id="reader" className="w-full"></div>
                                    </div>
                                    <p className="text-white/70 text-sm mt-8 text-center">将二维码放入框内，即可自动扫描</p>
                                </div>
                            </div>
                        )}

                        {/* Search User Modal */}
                        {showSearchUserModal && (
                            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in" onClick={() => { setShowSearchUserModal(false); setSearchUsername(''); setSearchStatus('idle'); setSearchResults([]); }}>
                                <div className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
                                    <div className="flex justify-between items-center mb-6">
                                        <h3 className="text-xl font-bold">添加好友</h3>
                                        <button onClick={() => { setShowSearchUserModal(false); setSearchUsername(''); setSearchStatus('idle'); setSearchResults([]); }} className="text-gray-400 hover:text-textMain"><i className="fa-solid fa-xmark text-xl"></i></button>
                                    </div>
                                    
                                    <form onSubmit={handleSearchUser} className="mb-6 relative">
                                        <input 
                                            type="text" 
                                            value={searchUsername} 
                                            onChange={e => { setSearchUsername(e.target.value); setSearchStatus('idle'); setSearchResults([]); }} 
                                            className="w-full p-4 pl-12 bg-secondary rounded-xl font-medium" 
                                            placeholder="输入昵称或6位数字ID搜索" 
                                            required 
                                        />
                                        <i className="fa-solid fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"></i>
                                        <button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2 bg-primary text-white px-4 py-2 rounded-lg text-sm font-bold active:scale-95 transition-transform">搜索</button>
                                    </form>

                                    {searchStatus === 'searching' && (
                                        <div className="text-center py-8 text-textSub">
                                            <i className="fa-solid fa-spinner fa-spin text-2xl mb-2 text-primary"></i>
                                            <p>搜索中...</p>
                                        </div>
                                    )}

                                    {searchStatus === 'not_found' && (
                                        <div className="text-center py-8 text-textSub bg-secondary rounded-xl">
                                            <p>未找到该用户，请检查拼写是否正确</p>
                                        </div>
                                    )}

                                    {searchStatus === 'done' && searchResults.length > 0 && (
                                        <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                                            {searchResults.map(user => {
                                                const isFriend = myFriends.some(f => f.id === user.id);
                                                const isSelf = user.id === currentUser.id;
                                                return (
                                                    <div key={user.id} className="bg-secondary p-4 rounded-xl flex items-center justify-between animate-fade-in border border-primary/20">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-12 h-12 rounded-full bg-primary text-white flex items-center justify-center font-bold text-lg shadow-sm">
                                                                {user.name.charAt(0).toUpperCase()}
                                                            </div>
                                                            <div className="flex flex-col">
                                                                <span className="font-bold text-textMain leading-tight">{user.name}</span>
                                                                <span className="text-xs text-textSub mt-0.5">ID: {user.user_code || '暂无'}</span>
                                                            </div>
                                                        </div>
                                                        {isSelf ? (
                                                            <span className="text-xs text-textSub font-bold px-3">我自己</span>
                                                        ) : isFriend ? (
                                                            <span className="text-xs text-textSub font-bold px-3">已添加</span>
                                                        ) : (
                                                            <button onClick={() => handleAddSearchedFriend(user)} className="bg-primary text-white px-4 py-2 rounded-full text-sm font-bold active:scale-95 transition-transform">
                                                                加为好友
                                                            </button>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                );
            }

            // --- Screen: Group Details ---
            if (activeScreen === 'group' && currentGroup) {
                // Unified Feed
                const feed = [...messages.map(m => ({ ...m, _type: 'message' })), ...bills.map(b => ({ ...b, _type: 'bill' }))]
                    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

                // If Add Expense is open, show the full screen calculator UI
                if (showAddExpense) {
                    return (
                        <div className="max-w-md mx-auto h-[100dvh] w-full bg-secondary flex flex-col animate-fade-in fixed inset-0 z-50 overflow-hidden">
                            {/* Top Bar */}
                            <div className="flex justify-between items-center p-4 bg-gradient-to-b from-blue-50 to-secondary">
                                <button onClick={() => setShowAddExpense(false)} className="w-8 h-8 flex items-center justify-center text-textMain text-xl">
                                    <i className="fa-solid fa-angle-left"></i>
                                </button>
                                <div className="flex items-center gap-2 font-bold text-lg">
                                    <span>{editingBillId ? '编辑账单' : '记账本'}</span>
                                    {!editingBillId && <i className="fa-solid fa-arrows-rotate text-sm text-textSub"></i>}
                                </div>
                                <div className="flex items-center gap-4">
                                    {editingBillId && (
                                        <button onClick={handleDeleteBill} disabled={isSubmittingExpense} className="text-red-500">
                                            <i className="fa-solid fa-trash-can"></i>
                                        </button>
                                    )}
                                    <button onClick={handleSubmitExpense} disabled={isSubmittingExpense} className={`text-primary font-bold ${isSubmittingExpense ? 'opacity-50' : ''}`}>
                                        {isSubmittingExpense ? <i className="fa-solid fa-spinner fa-spin"></i> : '保存'}
                                    </button>
                                </div>
                            </div>

                            {/* Tabs */}
                            <div className="flex justify-center gap-6 px-4 mb-4 font-medium text-textSub">
                                <button className="pb-1 border-b-2 text-primary border-primary font-bold">支出</button>
                            </div>

                            {/* Amount Display */}
                            <div className="px-4 mb-6">
                                <div className="bg-white rounded-2xl p-4 flex items-center justify-between shadow-sm">
                                    <div className="flex items-center gap-3 flex-1 overflow-hidden">
                                        <div className="bg-gray-200 text-gray-500 text-xs font-bold px-2 py-1 rounded flex items-center gap-1 cursor-pointer hover:bg-gray-300 transition-colors" onClick={openCurrencyModal}>
                                            <img src={`https://flagcdn.com/w20/${CURRENCY_DETAILS.find(c => c.code === currency)?.countryCode || 'cn'}.png`} alt={currency} className="w-4 h-auto rounded-sm object-cover" />
                                            <span>{currency}</span>
                                            <i className="fa-solid fa-caret-down text-[10px]"></i>
                                        </div>
                                        <div className="text-4xl font-bold text-textMain truncate">
                                            {amount}
                                            {currency !== currentGroup.main_currency && (
                                                <div className="text-[10px] text-textSub font-normal mt-1 flex items-center">
                                                    <i className="fa-solid fa-bolt text-primary mr-1"></i>
                                                    {(() => {
                                                        const num = parseFloat(amount);
                                                        if (isNaN(num) || num === 0) return `将自动按实时汇率转为 ${currentGroup.main_currency}`;
                                                        const rate = liveRates[currency];
                                                        if (!rate) return `将自动按实时汇率转为 ${currentGroup.main_currency}`;
                                                        const converted = (num * rate).toFixed(2);
                                                        return `约合 ${CURRENCY_SYMBOLS[currentGroup.main_currency] || ''}${converted} ${currentGroup.main_currency}`;
                                                    })()}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 pl-2 border-l border-gray-100 h-full relative">
                                        <button onClick={() => setAmount('0')} className="w-6 h-6 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center"><i className="fa-solid fa-xmark text-xs"></i></button>
                                        <div className="bg-primary text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 relative overflow-hidden">
                                            <i className="fa-regular fa-calendar"></i> 
                                            {expenseDate === getTodayString() ? '今天' : expenseDate.slice(5)}
                                            <input 
                                                type="date" 
                                                value={expenseDate} 
                                                onChange={e => setExpenseDate(e.target.value)} 
                                                onClick={e => e.target.showPicker && e.target.showPicker()}
                                                className="absolute inset-0 opacity-0 w-full h-full cursor-pointer" 
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Categories Grid */}
                            <div className="flex-1 overflow-y-auto px-4 pb-4">
                                <div className="grid grid-cols-5 gap-y-6 gap-x-2">
                                    {CATEGORIES.map(cat => (
                                        <button key={cat.id} onClick={() => setSelectedCategory(cat.id)} className="flex flex-col items-center gap-2">
                                            <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl transition-all ${selectedCategory === cat.id ? 'bg-primary text-white shadow-md transform scale-110' : 'bg-white text-gray-400 shadow-sm'}`}>
                                                <i className={`fa-solid ${cat.icon}`}></i>
                                            </div>
                                            <span className={`text-[10px] font-medium ${selectedCategory === cat.id ? 'text-primary font-bold' : 'text-textSub'}`}>{cat.name}</span>
                                        </button>
                                    ))}
                                </div>

                                {/* Options */}
                                <div className="mt-8 space-y-4 border-t border-gray-100 pt-4">
                                    <div className="flex justify-between items-center py-2">
                                        <span className="text-sm font-bold text-textSub">付款人 <i className="fa-solid fa-circle-exclamation text-xs ml-1"></i></span>
                                        <select value={payerId} onChange={e => setPayerId(e.target.value)} className="bg-transparent text-sm font-bold text-textMain text-right outline-none">
                                            {groupMembers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                                        </select>
                                    </div>
                                    <div className="flex justify-between items-center py-2">
                                        <span className="text-sm font-bold text-textSub">参与人 ({participants.length})</span>
                                        <div className="flex gap-1 flex-wrap justify-end max-w-[200px]">
                                            {groupMembers.map(m => (
                                                <button key={m.id} onClick={() => {
                                                    if(participants.includes(m.id)) setParticipants(prev => prev.filter(id => id !== m.id));
                                                    else setParticipants([...participants, m.id]);
                                                }} className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${participants.includes(m.id) ? 'bg-primary text-white' : 'bg-gray-200 text-gray-400'}`}>
                                                    {m.name.charAt(0)}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    
                                    {/* Advanced Split Options */}
                                    <div className="bg-secondary rounded-xl p-3 mt-2">
                                        <div className="flex bg-white rounded-lg p-1 shadow-sm mb-3">
                                            <button onClick={() => setSplitType('equal')} className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-colors ${splitType === 'equal' ? 'bg-primary text-white' : 'text-textSub'}`}>平分</button>
                                            <button onClick={() => setSplitType('exact')} className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-colors ${splitType === 'exact' ? 'bg-primary text-white' : 'text-textSub'}`}>具体金额</button>
                                            <button onClick={() => setSplitType('percent')} className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-colors ${splitType === 'percent' ? 'bg-primary text-white' : 'text-textSub'}`}>按比例</button>
                                        </div>
                                        
                                        {splitType !== 'equal' && (
                                            <div className="space-y-2 max-h-[150px] overflow-y-auto">
                                                {participants.map(pid => {
                                                    const m = groupMembers.find(g => g.id === pid);
                                                    if (!m) return null;
                                                    return (
                                                        <div key={pid} className="flex items-center justify-between text-sm bg-white p-2 rounded-lg">
                                                            <div className="flex items-center gap-2">
                                                                <div className="w-5 h-5 bg-gray-200 rounded-full flex items-center justify-center text-[10px] font-bold">{m.name.charAt(0)}</div>
                                                                <span className="font-medium">{m.name}</span>
                                                            </div>
                                                            <div className="flex items-center gap-1">
                                                                <input 
                                                                    type="number" 
                                                                    className="w-16 text-right bg-gray-50 border border-gray-200 rounded px-2 py-1 outline-none focus:border-primary text-xs"
                                                                    placeholder="0"
                                                                    value={splitAmounts[pid] || ''}
                                                                    onChange={e => setSplitAmounts({...splitAmounts, [pid]: e.target.value})}
                                                                />
                                                                <span className="text-xs text-textSub font-bold w-4">{splitType === 'exact' ? currency : '%'}</span>
                                                            </div>
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Keyboard */}
                            <div className="bg-white shadow-top pb-safe">
                                <div className="grid grid-cols-4 border-t border-gray-100">
                                    <button className="calc-btn py-4 text-2xl font-medium border-r border-b border-gray-100" onClick={() => handleCalcInput('7')}>7</button>
                                    <button className="calc-btn py-4 text-2xl font-medium border-r border-b border-gray-100" onClick={() => handleCalcInput('8')}>8</button>
                                    <button className="calc-btn py-4 text-2xl font-medium border-r border-b border-gray-100" onClick={() => handleCalcInput('9')}>9</button>
                                    <button className="calc-btn py-4 text-xl text-textSub border-b border-gray-100 flex items-center justify-center" onClick={handleDeleteCalc}><i className="fa-solid fa-delete-left"></i></button>
                                    
                                    <button className="calc-btn py-4 text-2xl font-medium border-r border-b border-gray-100" onClick={() => handleCalcInput('4')}>4</button>
                                    <button className="calc-btn py-4 text-2xl font-medium border-r border-b border-gray-100" onClick={() => handleCalcInput('5')}>5</button>
                                    <button className="calc-btn py-4 text-2xl font-medium border-r border-b border-gray-100" onClick={() => handleCalcInput('6')}>6</button>
                                    <button className="calc-btn py-4 text-xl text-textSub border-b border-gray-100" onClick={() => handleCalcInput('+')}>+</button>
                                    
                                    <button className="calc-btn py-4 text-2xl font-medium border-r border-b border-gray-100" onClick={() => handleCalcInput('1')}>1</button>
                                    <button className="calc-btn py-4 text-2xl font-medium border-r border-b border-gray-100" onClick={() => handleCalcInput('2')}>2</button>
                                    <button className="calc-btn py-4 text-2xl font-medium border-r border-b border-gray-100" onClick={() => handleCalcInput('3')}>3</button>
                                    <button className={`calc-btn-primary row-span-2 bg-primary text-white font-bold text-xl flex flex-col items-center justify-center`} onClick={() => {
                                        // Evaluate expression if contains + or -
                                        if (amount.includes('+') || amount.includes('-')) {
                                            try {
                                                const result = eval(amount);
                                                setAmount(Number(result).toFixed(2).replace(/\.00$/, ''));
                                            } catch (e) {
                                                setAmount('0');
                                            }
                                        } else {
                                            // Just format or close keyboard (we format it to clean up trailing dots)
                                            setAmount(Number(amount).toString());
                                        }
                                    }}>
                                        {amount.includes('+') || amount.includes('-') ? '=' : '确定'}
                                    </button>
                                    
                                    <button className="calc-btn py-4 text-xl text-textSub border-r border-gray-100" onClick={() => handleCalcInput('-')}>-</button>
                                    <button className="calc-btn py-4 text-2xl font-medium border-r border-gray-100" onClick={() => handleCalcInput('0')}>0</button>
                                    <button className="calc-btn py-4 text-2xl font-medium border-r border-gray-100" onClick={() => handleCalcInput('.')}>.</button>
                                </div>
                            </div>

                            {/* Currency Selection Modal */}
                            {showCurrencyModal && (
                                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex flex-col justify-end z-[60] animate-fade-in" onClick={() => setShowCurrencyModal(false)}>
                                    <div className="bg-white w-full rounded-t-3xl flex flex-col max-h-[85vh]" onClick={e => e.stopPropagation()}>
                                        {/* Header */}
                                        <div className="flex justify-between items-center p-4 border-b border-gray-100 shrink-0">
                                            <div className="w-8"></div>
                                            <h3 className="text-lg font-bold">选择货币</h3>
                                            <button onClick={() => setShowCurrencyModal(false)} className="w-8 h-8 text-gray-400 hover:text-textMain flex items-center justify-center">
                                                <i className="fa-solid fa-xmark text-xl"></i>
                                            </button>
                                        </div>
                                        
                                        {/* Subtitle */}
                                        <div className="text-center text-xs text-textSub py-2 bg-gray-50/50">
                                            实时汇率由互联网数据服务商提供，点击 <i className="fa-solid fa-pen text-[10px] text-primary mx-0.5"></i> 可进行编辑
                                        </div>
                                        
                                        {/* Search */}
                                        <div className="p-3 shrink-0">
                                            <div className="bg-secondary rounded-xl flex items-center px-3 py-2">
                                                <i className="fa-solid fa-magnifying-glass text-gray-400 mr-2"></i>
                                                <input 
                                                    type="text" 
                                                    placeholder="请输入币种代码或名称" 
                                                    value={currencySearch}
                                                    onChange={e => setCurrencySearch(e.target.value)}
                                                    className="bg-transparent outline-none flex-1 text-sm"
                                                />
                                            </div>
                                        </div>
                                        
                                        {/* List */}
                                        <div className="flex-1 overflow-y-auto pb-safe">
                                            <div className="px-4 py-1 text-xs text-textSub bg-gray-50">常用币种</div>
                                            <div className="divide-y divide-gray-50">
                                                {CURRENCY_DETAILS.filter(c => c.code.toLowerCase().includes(currencySearch.toLowerCase()) || c.name.includes(currencySearch)).map(c => {
                                                    const isMain = c.code === currentGroup.main_currency;
                                                    const rate = isMain ? 1 : (liveRates[c.code] || 0);
                                                    const rateStr = rate ? Number(rate).toFixed(5) : '...';
                                                    const isSelected = currency === c.code;
                                                    
                                                    return (
                                                        <div key={c.code} className="flex items-center justify-between p-4 active:bg-gray-50 transition-colors cursor-pointer" onClick={() => { setCurrency(c.code); setShowCurrencyModal(false); }}>
                                                            <div className="flex items-center gap-4">
                                                                <div className="w-8 h-auto shadow-sm rounded-sm overflow-hidden flex items-center justify-center">
                                                                    <img src={`https://flagcdn.com/w40/${c.countryCode}.png`} alt={c.code} className="w-full h-auto object-cover" />
                                                                </div>
                                                                <div>
                                                                    <div className="font-bold text-textMain text-sm">{c.code}-{c.name}</div>
                                                                    <div className="text-xs text-textSub mt-0.5 flex items-center gap-1">
                                                                        1 {c.code}={rateStr} {currentGroup.main_currency}
                                                                        {!isMain && <i className="fa-solid fa-pen text-[10px] text-primary ml-1" onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            const newRate = prompt(`编辑汇率 (1 ${c.code} = ? ${currentGroup.main_currency})`, rateStr);
                                                                            if (newRate && !isNaN(newRate)) {
                                                                                setLiveRates({...liveRates, [c.code]: parseFloat(newRate)});
                                                                            }
                                                                        }}></i>}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            {isSelected && (
                                                                <div className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center">
                                                                    <i className="fa-solid fa-check text-xs"></i>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                }

                // Group List View -> Replaced with Chat View
                return (
                    <div className="flex flex-col h-[100dvh] bg-[#f4f5f7] animate-fade-in relative overflow-hidden">
                        {/* Header */}
                        <div className="glass-header px-5 pt-safe pb-3 sticky top-0 z-20 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <button onClick={() => { setActiveScreen('dashboard'); setCurrentTab('home'); }} className="w-10 h-10 flex items-center justify-center -ml-2 text-textMain active:scale-90 transition-transform">
                                    <i className="fa-solid fa-angle-left text-2xl"></i>
                                </button>
                                <div>
                                    <h2 className="text-xl font-bold text-textMain">{currentGroup.name} <span className="text-sm font-normal text-textSub">({groupMembers.length})</span></h2>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <button onClick={() => { setQrData({ type: 'group', id: currentGroup.id }); setShowQRModal(true); }} className="w-8 h-8 flex items-center justify-center text-textMain active:scale-90 transition-transform"><i className="fa-solid fa-qrcode text-lg"></i></button>
                                <button onClick={handleSettleUp} className="w-8 h-8 flex items-center justify-center text-primary active:scale-90 transition-transform"><i className="fa-solid fa-scale-balanced text-lg"></i></button>
                            </div>
                        </div>

                        {/* Chat Messages Area */}
                        {/* Smart Suggestion Overlay */}
                        {smartSuggestion && (
                            <div className="bg-white mx-4 mt-4 p-4 rounded-2xl shadow-float flex items-center justify-between animate-fade-in z-20">
                                <div>
                                    <p className="text-xs text-textSub mb-1">检测到记账意图</p>
                                    <p className="font-bold text-textMain">记一笔 {smartSuggestion.amount} 元？</p>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => setSmartSuggestion(null)} className="w-8 h-8 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center"><i className="fa-solid fa-xmark"></i></button>
                                    <button onClick={handleAcceptSmartSuggestion} className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center"><i className="fa-solid fa-check"></i></button>
                                </div>
                            </div>
                        )}

                        {/* Chat Feed */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-20" ref={chatScrollRef}>
                            {feed.length === 0 && (
                                <div className="text-center text-textSub mt-10 text-sm">
                                    还没有聊天记录，发个消息或者记一笔吧！
                                </div>
                            )}
                            {feed.map(item => {
                                const sender = groupMembers.find(m => m.id === (item._type === 'message' ? item.user_id : item.payer_id));
                                const senderName = sender ? sender.name : 'Unknown';
                                const isMe = sender && sender.id === currentUser.id;

                                if (item._type === 'bill') {
                                    // Bill Card (rendered in center)
                                    const cat = CATEGORIES.find(c => c.id === item.category) || CATEGORIES[0];
                                    return (
                                        <div key={`bill-${item.id}`} className="flex justify-center my-4 animate-fade-in">
                                            <div 
                                                className="bg-white rounded-2xl shadow-soft w-[85%] overflow-hidden cursor-pointer active:scale-95 transition-transform relative group"
                                                onClick={() => handleEditBill(item)}
                                            >
                                                <div className={`${cat.color.split(' ')[0]} p-3 flex items-center gap-3`}>
                                                    <div className="w-8 h-8 bg-white/50 rounded-full flex items-center justify-center text-current"><i className={`fa-solid ${cat.icon}`}></i></div>
                                                    <span className="font-bold text-current">{cat.name}</span>
                                                    <span className="ml-auto font-bold text-current">{item.original_currency !== currentGroup.main_currency ? item.original_currency : ''} {item.original_amount}</span>
                                                </div>
                                                <div className="p-3 bg-white text-xs text-textSub flex justify-between items-center">
                                                    <span>由 {senderName} 支付</span>
                                                    <span>{getBillParticipantIds(item).length} 人参与</span>
                                                </div>
                                                {/* Edit hint overlay */}
                                                <div className="absolute inset-0 bg-black/5 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                                    <div className="bg-white/90 text-textMain px-3 py-1 rounded-full text-xs font-bold shadow-sm">点击编辑</div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                } else {
                                    // Chat Message Bubble
                                    const parsedExpense = parseExpenseText(item.content);
                                    
                                    return (
                                        <div key={`msg-${item.id}`} className={`flex gap-3 animate-fade-in ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-gray-300 to-gray-400 text-white flex items-center justify-center font-bold shrink-0 shadow-sm">
                                                {senderName.charAt(0).toUpperCase()}
                                            </div>
                                            <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                                                <span className="text-[10px] text-textSub mb-1 px-1">{senderName}</span>
                                                <div className="relative group">
                                                    <div 
                                                        className={`p-3 rounded-2xl max-w-[240px] shadow-sm break-words ${parsedExpense ? 'cursor-pointer active:scale-95 transition-transform' : ''} ${isMe ? 'bg-primary text-white rounded-tr-none' : 'bg-white text-textMain rounded-tl-none'}`}
                                                        onClick={() => parsedExpense && handleMessageClick(item.content, item.user_id)}
                                                    >
                                                        {item.content}
                                                    </div>
                                                    {/* Hint for parsable expense */}
                                                    {parsedExpense && (
                                                        <div className={`absolute -bottom-5 ${isMe ? 'right-2' : 'left-2'} text-[10px] text-orange-400 whitespace-nowrap flex items-center gap-1 font-medium`}>
                                                            <i className="fa-solid fa-hand-pointer animate-pulse"></i>
                                                            点击记账 (¥{parsedExpense.amount})
                                                        </div>
                                                    )}
                                                </div>
                                                {parsedExpense && <div className="h-4"></div> /* Spacer for the absolute hint */}
                                            </div>
                                        </div>
                                    );
                                }
                            })}
                        </div>

                        {/* Floating Add Expense Button */}
                        <div className="absolute bottom-20 right-4 z-10">
                            <button onClick={openAddExpense} className="bg-primary text-white shadow-float rounded-full px-5 py-3 font-bold flex items-center gap-2 active:scale-95 transition-transform">
                                <i className="fa-solid fa-plus"></i> 记一笔
                            </button>
                        </div>

                        {/* Bottom Input Bar */}
                        <div className="bg-[#f6f6f6] border-t border-gray-200 p-3 pb-safe flex items-end gap-2 shrink-0 z-20 relative">
                            <button onClick={openGameModal} className="w-10 h-10 rounded-full flex items-center justify-center text-gray-500 hover:text-orange-500 shrink-0 bg-white shadow-sm border border-gray-200">
                                <i className="fa-solid fa-gamepad text-xl"></i>
                            </button>
                            
                            <form onSubmit={handleSendChat} className="flex-1 flex gap-2">
                                <input 
                                    type="text" 
                                    value={chatInput}
                                    onChange={e => setChatInput(e.target.value)}
                                    className="flex-1 bg-white rounded-full px-4 py-2.5 outline-none border border-gray-200 focus:border-primary transition-colors"
                                    placeholder="发消息..."
                                />
                                <button type="submit" disabled={!chatInput.trim()} className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 shadow-sm transition-colors ${chatInput.trim() ? 'bg-primary text-white' : 'bg-gray-200 text-gray-400'}`}>
                                    <i className="fa-solid fa-paper-plane"></i>
                                </button>
                            </form>
                        </div>

                        {/* Modals... */}
                        {showGameModal && (
                            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in" onClick={() => gameStatus !== 'playing' && setShowGameModal(false)}>
                                <div className="bg-white rounded-3xl p-6 max-w-sm w-full mx-4 shadow-2xl relative" onClick={e => e.stopPropagation()}>
                                    {/* Header */}
                                    {gameMode === 'select' ? (
                                        <div className="flex justify-between items-center mb-6">
                                            <h3 className="text-xl font-bold">谁来买单？🎮</h3>
                                            <button onClick={() => setShowGameModal(false)} className="text-gray-400 hover:text-textMain"><i className="fa-solid fa-xmark text-xl"></i></button>
                                        </div>
                                    ) : (
                                        <div className="flex justify-between items-center mb-6">
                                            <button onClick={() => { setGameMode('select'); setGameStatus('idle'); setGameWinner(null); }} className="text-gray-400 hover:text-textMain" disabled={gameStatus === 'playing'}><i className="fa-solid fa-angle-left text-xl"></i></button>
                                            <h3 className="text-lg font-bold">
                                                {gameMode === 'roulette' ? '幸运大转盘' : gameMode === 'cards' ? '炸弹翻牌' : '掷骰子比小'}
                                            </h3>
                                            <div className="w-5"></div>
                                        </div>
                                    )}

                                    {/* SELECT MODE */}
                                    {gameMode === 'select' && (
                                        <div className="space-y-4">
                                            <button onClick={() => { setGameMode('roulette'); setGameStatus('idle'); setGameWinner(null); }} className="w-full bg-orange-50 p-4 rounded-2xl flex items-center gap-4 active:scale-95 transition-transform">
                                                <div className="w-12 h-12 bg-orange-100 text-orange-500 rounded-full flex items-center justify-center text-2xl">🎡</div>
                                                <div className="text-left"><div className="font-bold text-textMain">幸运大转盘</div><div className="text-xs text-textSub">快速随机抽取一名幸运儿</div></div>
                                            </button>
                                            <button onClick={() => { setGameMode('cards'); initCards(); }} className="w-full bg-rose-50 p-4 rounded-2xl flex items-center gap-4 active:scale-95 transition-transform">
                                                <div className="w-12 h-12 bg-rose-100 text-rose-500 rounded-full flex items-center justify-center text-2xl">💣</div>
                                                <div className="text-left"><div className="font-bold text-textMain">炸弹翻牌</div><div className="text-xs text-textSub">轮流翻牌，翻到炸弹买单</div></div>
                                            </button>
                                            <button onClick={() => { setGameMode('dice'); initDice(); }} className="w-full bg-blue-50 p-4 rounded-2xl flex items-center gap-4 active:scale-95 transition-transform">
                                                <div className="w-12 h-12 bg-blue-100 text-blue-500 rounded-full flex items-center justify-center text-2xl">🎲</div>
                                                <div className="text-left"><div className="font-bold text-textMain">掷骰子比小</div><div className="text-xs text-textSub">全员掷骰子，点数最小者买单</div></div>
                                            </button>
                                        </div>
                                    )}

                                    {/* ROULETTE MODE */}
                                    {gameMode === 'roulette' && (
                                        <div className="text-center">
                                            <div className="h-32 flex items-center justify-center mb-6">
                                                {gameWinner ? (
                                                    <div className="animate-fade-in flex flex-col items-center">
                                                        <div className={`w-20 h-20 rounded-full flex items-center justify-center text-3xl text-white font-bold mb-3 shadow-lg ${gameStatus === 'playing' ? 'bg-gray-400' : 'bg-orange-500 animate-bounce'}`}>
                                                            {gameWinner.name.charAt(0).toUpperCase()}
                                                        </div>
                                                        <span className={`text-xl font-bold ${gameStatus === 'playing' ? 'text-gray-500' : 'text-orange-500'}`}>{gameWinner.name}</span>
                                                        {gameStatus === 'done' && <span className="text-sm text-textSub mt-1">就是你了！</span>}
                                                    </div>
                                                ) : (
                                                    <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center text-4xl text-gray-300">?</div>
                                                )}
                                            </div>
                                            {gameStatus === 'done' ? (
                                                <div className="flex gap-3 mt-4">
                                                    <button onClick={initRoulette} className="flex-1 py-3 bg-secondary text-textMain font-bold rounded-xl active:scale-95">再抽一次</button>
                                                    <button onClick={handleGameSettle} className="flex-1 py-3 bg-orange-500 text-white font-bold rounded-xl shadow-float active:scale-95">去记账</button>
                                                </div>
                                            ) : (
                                                <button onClick={initRoulette} disabled={gameStatus === 'playing'} className={`w-full py-4 rounded-xl font-bold text-white shadow-float transition-all ${gameStatus === 'playing' ? 'bg-gray-400 cursor-not-allowed' : 'bg-orange-500 active:scale-95'}`}>
                                                    {gameStatus === 'playing' ? '抽取中...' : '开始抽取'}
                                                </button>
                                            )}
                                        </div>
                                    )}

                                    {/* CARDS MODE */}
                                    {gameMode === 'cards' && gameData.members && (
                                        <div className="text-center">
                                            <div className="grid grid-cols-3 gap-3 mb-6 max-h-[300px] overflow-y-auto p-2">
                                                {gameData.members.map((m, idx) => {
                                                    const isFlipped = gameData.flipped.includes(idx);
                                                    const isBomb = idx === gameData.bombIdx;
                                                    return (
                                                        <div key={idx} onClick={() => handleCardClick(idx)} className="relative aspect-[3/4] w-full [perspective:1000px]">
                                                            <div className={`w-full h-full transition-transform duration-500 [transform-style:preserve-3d] ${isFlipped ? '[transform:rotateY(180deg)]' : 'cursor-pointer hover:scale-105 active:scale-95'}`}>
                                                                {/* Front (Hidden initially) */}
                                                                <div className="absolute inset-0 bg-rose-500 rounded-xl shadow-md flex items-center justify-center [backface-visibility:hidden]">
                                                                    <div className="text-white text-3xl font-bold">?</div>
                                                                </div>
                                                                {/* Back (Revealed) */}
                                                                <div className={`absolute inset-0 rounded-xl shadow-inner flex flex-col items-center justify-center [backface-visibility:hidden] [transform:rotateY(180deg)] ${isBomb ? 'bg-gray-900 text-white' : 'bg-green-50 text-green-600 border border-green-200'}`}>
                                                                    <div className="text-3xl mb-1">{isBomb ? '💣' : '✅'}</div>
                                                                    <div className="text-[10px] font-bold truncate w-full px-1">{m.name}</div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                            {gameStatus === 'done' ? (
                                                <div className="animate-fade-in">
                                                    <p className="text-rose-500 font-bold mb-4 text-lg">💥 炸弹爆炸！{gameWinner?.name} 买单！</p>
                                                    <div className="flex gap-3">
                                                        <button onClick={initCards} className="flex-1 py-3 bg-secondary text-textMain font-bold rounded-xl active:scale-95">再玩一次</button>
                                                        <button onClick={handleGameSettle} className="flex-1 py-3 bg-rose-500 text-white font-bold rounded-xl shadow-float active:scale-95">去记账</button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <p className="text-textSub text-sm mb-2">请大家依次点击翻牌...</p>
                                            )}
                                        </div>
                                    )}

                                    {/* DICE MODE */}
                                    {gameMode === 'dice' && gameData.results && (
                                        <div className="text-center">
                                            <div className="grid grid-cols-2 gap-3 mb-6 max-h-[300px] overflow-y-auto p-2">
                                                {groupMembers.map(m => {
                                                    const score = gameData.results[m.id] || 1;
                                                    const isLoser = gameStatus === 'done' && gameData.losers?.includes(m.id);
                                                    return (
                                                        <div key={m.id} className={`p-3 rounded-xl flex items-center justify-between border-2 transition-all ${isLoser ? 'border-blue-500 bg-blue-50' : 'border-gray-100 bg-white'}`}>
                                                            <div className="text-xs font-bold truncate max-w-[60px] text-left">{m.name}</div>
                                                            <div className={`text-3xl leading-none ${gameData.rolling ? 'animate-bounce' : ''}`}>
                                                                {['','⚀','⚁','⚂','⚃','⚄','⚅'][score]}
                                                            </div>
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                            {gameStatus === 'done' ? (
                                                <div className="animate-fade-in">
                                                    <p className="text-blue-500 font-bold mb-4 text-lg">😭 点数最小！{gameWinner?.name} 买单！</p>
                                                    <div className="flex gap-3">
                                                        <button onClick={initDice} className="flex-1 py-3 bg-secondary text-textMain font-bold rounded-xl active:scale-95">再掷一次</button>
                                                        <button onClick={handleGameSettle} className="flex-1 py-3 bg-blue-500 text-white font-bold rounded-xl shadow-float active:scale-95">去记账</button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <button onClick={initDice} disabled={gameData.rolling} className={`w-full py-4 rounded-xl font-bold text-white shadow-float transition-all ${gameData.rolling ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-500 active:scale-95'}`}>
                                                    {gameData.rolling ? '掷骰子中...' : '全员掷骰子'}
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {showQRModal && (
                            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in" onClick={() => setShowQRModal(false)}>
                                <div className="bg-white rounded-3xl p-8 max-w-[300px] w-full text-center shadow-2xl" onClick={e => e.stopPropagation()}>
                                    <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center text-primary mx-auto mb-4">
                                        <i className="fa-solid fa-users text-xl"></i>
                                    </div>
                                    <h3 className="text-xl font-bold text-textMain mb-1">邀请加入群组</h3>
                                    <p className="text-sm text-textSub mb-6">扫描二维码直接进入记账群</p>
                                    <div className="bg-secondary p-4 rounded-2xl flex justify-center mb-6">
                                        <div id="qrcode" ref={qrRef}></div>
                                    </div>
                                    <button onClick={() => setShowQRModal(false)} className="w-full py-3.5 bg-secondary text-textMain font-bold rounded-xl active:scale-95">关闭</button>
                                </div>
                            </div>
                        )}

                        {/* Settle Up Modal */}
                        {showSettleModal && (() => {
                            const totalGroupExpense = bills.reduce((sum, b) => sum + b.amount, 0);
                            const categoryGroupMap = {};
                            bills.forEach(b => {
                                categoryGroupMap[b.category] = (categoryGroupMap[b.category] || 0) + b.amount;
                            });
                            const sortedGroupCategories = Object.keys(categoryGroupMap).map(catId => ({
                                catId, amount: categoryGroupMap[catId]
                            })).sort((a, b) => b.amount - a.amount);

                            return (
                                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 animate-fade-in" onClick={() => setShowSettleModal(false)}>
                                    <div className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl p-6 pb-safe shadow-2xl flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
                                        <div className="flex justify-between items-center mb-6 shrink-0">
                                            <div className="flex items-center gap-2">
                                                <div className="w-8 h-8 rounded-full bg-primaryLight text-primary flex items-center justify-center">
                                                    <i className="fa-solid fa-scale-balanced"></i>
                                                </div>
                                                <h3 className="text-xl font-bold">结算方案</h3>
                                            </div>
                                            <button onClick={() => setShowSettleModal(false)} className="text-gray-400 hover:text-textMain"><i className="fa-solid fa-xmark text-xl"></i></button>
                                        </div>
                                        
                                        <div className="overflow-y-auto pr-2 space-y-6 flex-1 pb-4">
                                            {/* 1. Overview */}
                                            <div>
                                                <div className="text-center mb-4">
                                                    <div className="text-sm text-textSub mb-1">群组总支出</div>
                                                    <div className="text-3xl font-bold text-textMain"><span className="text-lg font-normal text-textSub mr-1">{currentGroup.main_currency}</span>{totalGroupExpense.toFixed(2)}</div>
                                                </div>
                                                
                                                {sortedGroupCategories.length > 0 && (
                                                    <div className="flex overflow-x-auto gap-3 pb-2 no-scrollbar">
                                                        {sortedGroupCategories.map(catItem => {
                                                            const cat = CATEGORIES.find(c => c.id === catItem.catId) || CATEGORIES[0];
                                                            return (
                                                                <div key={cat.id} className="bg-secondary rounded-xl p-3 flex-shrink-0 min-w-[90px] flex flex-col items-center justify-center gap-1">
                                                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${cat.color}`}><i className={`fa-solid ${cat.icon}`}></i></div>
                                                                    <div className="text-xs text-textSub">{cat.name}</div>
                                                                    <div className="text-sm font-bold">{catItem.amount.toFixed(2)}</div>
                                                                </div>
                                                            )
                                                        })}
                                                    </div>
                                                )}
                                            </div>

                                            {/* 2. Settlement Plan */}
                                            <div>
                                                <h4 className="font-bold text-md mb-3 flex items-center gap-2"><i className="fa-solid fa-money-bill-transfer text-primary"></i> 谁该给谁</h4>
                                                <div className="space-y-3">
                                                    {settlements.length === 0 ? (
                                                        <div className="text-center py-4 text-textSub bg-secondary rounded-2xl">
                                                            <i className="fa-regular fa-face-smile text-2xl mb-2 text-gray-300 block"></i>
                                                            <p className="text-sm">太棒了！大家互不相欠</p>
                                                        </div>
                                                    ) : (
                                                        settlements.map((s, idx) => (
                                                            <div key={idx} className="bg-secondary p-4 rounded-2xl flex items-center justify-between shadow-sm border border-gray-100">
                                                                <div className="flex items-center gap-3">
                                                                    <div className="font-bold text-textMain">{s.from}</div>
                                                                    <div className="text-gray-300"><i className="fa-solid fa-arrow-right-long"></i></div>
                                                                    <div className="font-bold text-textMain">{s.to}</div>
                                                                </div>
                                                                <div className="font-bold text-primary text-lg flex items-center gap-1">
                                                                    <span className="text-xs text-textMain font-normal">{currentGroup.main_currency}</span> {s.amount}
                                                                </div>
                                                            </div>
                                                        ))
                                                    )}
                                                </div>
                                            </div>

                                            {/* 3. Bills List */}
                                            <div>
                                                <h4 className="font-bold text-md mb-3 flex items-center gap-2"><i className="fa-solid fa-list-ul text-primary"></i> 账单明细</h4>
                                                <div className="space-y-2">
                                                    {bills.length === 0 ? (
                                                        <div className="text-center py-4 text-textSub text-sm">暂无账单记录</div>
                                                    ) : (
                                                        bills.map(b => {
                                                            const cat = CATEGORIES.find(c => c.id === b.category) || CATEGORIES[0];
                                                            const payer = groupMembers.find(m => m.id === b.payer_id);
                                                            return (
                                                                <div key={b.id} className="bg-white border border-gray-100 p-3 rounded-xl flex items-center justify-between shadow-sm">
                                                                    <div className="flex items-center gap-3">
                                                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs ${cat.color}`}>
                                                                            <i className={`fa-solid ${cat.icon}`}></i>
                                                                        </div>
                                                                        <div>
                                                                            <div className="text-sm font-bold text-textMain">{cat.name}</div>
                                                                            <div className="text-[10px] text-textSub">{payer?.name || '未知'} 支付 · {b.date}</div>
                                                                        </div>
                                                                    </div>
                                                                    <div className="font-bold text-sm text-textMain">
                                                                        {b.amount.toFixed(2)}
                                                                    </div>
                                                                </div>
                                                            )
                                                        })
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        
                                        <button onClick={() => setShowSettleModal(false)} className="w-full bg-primary text-white font-bold py-4 rounded-xl shadow-float active:scale-95 shrink-0 mt-2">我知道了</button>
                                    </div>
                                </div>
                            );
                        })()}
                    </div>
                );
            }

            return null;
        }

        const style = document.createElement('style');
        style.innerHTML = `
            .animate-fade-in { animation: fadeIn 0.2s ease-out forwards; }
            @keyframes fadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
            .pb-safe { padding-bottom: env(safe-area-inset-bottom, 20px); }
        `;
        document.head.appendChild(style);

        const root = ReactDOM.createRoot(document.getElementById('root'));
        root.render(<App />);
    