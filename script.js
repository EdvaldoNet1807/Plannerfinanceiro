import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, setDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// --- Configuração do Firebase ---
const firebaseConfig = {
    apiKey: "AIzaSyDmgBe4wqDaamTRRlolUSBCR1Hp9wYScoU",
    authDomain: "financeiro-7c28e.firebaseapp.com",
    projectId: "financeiro-7c28e",
    storageBucket: "financeiro-7c28e.appspot.com",
    messagingSenderId: "29137515180",
    appId: "1:29137515180:web:80ea12781a59b001bfe509"
};

// --- Inicialização ---
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- Elementos da UI ---
const loadingOverlay = document.getElementById('loadingOverlay');
const authOverlay = document.getElementById('authOverlay');
const appWrapper = document.getElementById('appWrapper');
const authError = document.getElementById('authError');
const themeToggleBtn = document.getElementById('themeToggleBtn');

// --- Estado da Aplicação ---
let state = {
    currentUser: null,
    financialData: {},
    charts: {},
    unsubscribe: null,
};

// --- LÓGICA DE NAVEGAÇÃO (ROTEAMENTO) ---
function setupNavigation() {
    const navLinks = document.querySelectorAll('.nav-link');
    const pageContents = document.querySelectorAll('.page-content');

    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = link.getAttribute('href').substring(1);

            pageContents.forEach(page => page.style.display = 'none');
            document.getElementById(targetId).style.display = 'block';

            navLinks.forEach(nav => nav.classList.remove('active'));
            link.classList.add('active');
        });
    });
    document.querySelector('#dashboard').style.display = 'block';
}

// --- LÓGICA DE AUTENTICAÇÃO ---
function setupAuthUI() {
    document.getElementById('registerBtn').addEventListener('click', async () => {
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        authError.textContent = '';
        try {
            await createUserWithEmailAndPassword(auth, email, password);
        } catch (error) { authError.textContent = "Erro ao registar: " + error.message; }
    });

    document.getElementById('loginBtn').addEventListener('click', async () => {
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        authError.textContent = '';
        try {
            await signInWithEmailAndPassword(auth, email, password);
        } catch (error) { authError.textContent = "Erro ao entrar: " + error.message; }
    });
    
    document.getElementById('logoutBtn').addEventListener('click', () => signOut(auth));
}

// --- LÓGICA DE DADOS (FIRESTORE) ---
async function setupFirestoreListener(user) {
    const financialDataRef = doc(db, `financial_planners/${user.uid}/data`, 'main');
    if (state.unsubscribe) state.unsubscribe();

    state.unsubscribe = onSnapshot(financialDataRef, (docSnap) => {
        if (docSnap.exists()) {
            state.financialData = docSnap.data();
            renderUI(state.financialData);
        } else {
            createInitialDocument(financialDataRef);
        }
        hideLoading();
    }, (error) => console.error("Erro ao carregar dados:", error));
}

async function createInitialDocument(docRef) {
    const initialData = {
        theme: 'light',
        incomes: [{ id: Date.now(), name: 'Salário', value: 2500 }],
        expenses: [{ id: Date.now() + 1, name: 'Aluguel', value: 800 }],
        goals: [{ id: Date.now() + 2, name: 'Viagem', target: 3000, current: 200 }],
        cards: [{ id: Date.now() + 3, name: 'Meu Cartão', limit: 1500, current: 500 }],
        subscriptions: [{ id: Date.now() + 4, name: 'Netflix', value: 39.90 }],
    };
    await setDoc(docRef, initialData);
}

async function saveDataToFirestore() {
    document.getElementById('saveChangesBtn').disabled = true;
    
    const dataToSave = {
        theme: document.documentElement.classList.contains('dark') ? 'dark' : 'light',
        incomes: [], expenses: [], goals: [], cards: [], subscriptions: []
    };
    
    // Mapeia os tipos de dados para as suas respetivas listas e campos
    const dataMap = {
        incomes: { listId: 'incomesList', fields: ['name', 'value'] },
        expenses: { listId: 'expensesList', fields: ['name', 'value'] },
        goals: { listId: 'goalsList', fields: ['name', 'current', 'target'] },
        cards: { listId: 'cardsList', fields: ['name', 'current', 'limit'] },
        subscriptions: { listId: 'subscriptionsList', fields: ['name', 'value'] }
    };

    for (const type in dataMap) {
        const { listId, fields } = dataMap[type];
        document.querySelectorAll(`#${listId} .item-entry`).forEach(entry => {
            const itemData = { id: entry.dataset.id };
            fields.forEach(field => {
                const input = entry.querySelector(`.item-${field}`);
                itemData[field] = (input.type === 'number') ? parseFloat(input.value) || 0 : input.value;
            });
            dataToSave[type].push(itemData);
        });
    }
    
    const financialDataRef = doc(db, `financial_planners/${state.currentUser.uid}/data`, 'main');
    try {
        await setDoc(financialDataRef, dataToSave);
        const saveMessage = document.getElementById('saveMessage');
        saveMessage.textContent = 'Dados salvos!';
        setTimeout(() => { saveMessage.textContent = ''; }, 3000);
    } catch (error) {
        console.error("Erro ao salvar:", error);
    } finally {
        document.getElementById('saveChangesBtn').disabled = false;
    }
}

// --- LÓGICA DE RENDERIZAÇÃO E UI ---
function renderUI(data) {
    applyTheme(data.theme || 'light');
    renderDynamicLists(data);
    const calculatedData = calculateTotals(data);
    renderKPIs(calculatedData);
    renderCharts(calculatedData);
}

function applyTheme(theme) {
    const html = document.documentElement;
    if (theme === 'dark') {
        html.classList.add('dark');
        themeToggleBtn.textContent = '☀️';
    } else {
        html.classList.remove('dark');
        themeToggleBtn.textContent = '🌙';
    }
}

function renderDynamicLists(data) {
    const lists = { incomes: 'incomesList', expenses: 'expensesList', goals: 'goalsList', cards: 'cardsList', subscriptions: 'subscriptionsList' };
    for(const key in lists) {
        const container = document.getElementById(lists[key]);
        container.innerHTML = '';
        if(data[key]) {
            data[key].forEach(item => addEntryToDOM(key, item));
        }
    }
}

function calculateTotals(data) {
    const incomeTotal = data.incomes?.reduce((sum, item) => sum + item.value, 0) || 0;
    const expenseTotal = data.expenses?.reduce((sum, item) => sum + item.value, 0) || 0;
    const goalsTotal = data.goals?.reduce((sum, item) => sum + item.target, 0) || 0;
    const surplus = incomeTotal - expenseTotal;
    return { incomeTotal, expenseTotal, goalsTotal, surplus, allData: data };
}

function renderKPIs({ incomeTotal, expenseTotal, surplus, goalsTotal }) {
    document.getElementById('kpiSalario').textContent = formatCurrency(incomeTotal);
    document.getElementById('kpiGastos').textContent = formatCurrency(expenseTotal);
    document.getElementById('kpiSobra').textContent = formatCurrency(surplus);
    document.getElementById('kpiMetas').textContent = formatCurrency(goalsTotal);
}

function initializeCharts() {
    const budgetCanvas = document.getElementById('budgetChart');
    if(budgetCanvas && !state.charts.budget) {
        state.charts.budget = new Chart(budgetCanvas, {
            type: 'doughnut',
            data: { labels: ['Rendas', 'Despesas', 'Sobra'], datasets: [{ data: [], backgroundColor: ['#4ECDC4', '#FF6B6B', '#45B7D1'] }] },
            options: { responsive: true, maintainAspectRatio: false }
        });
    }
}

function renderCharts({ incomeTotal, expenseTotal, surplus, allData }) {
    if(state.charts.budget) {
        state.charts.budget.data.datasets[0].data = [incomeTotal, expenseTotal, Math.max(0, surplus)];
        state.charts.budget.update();
    }
    const goalsContainer = document.getElementById('goalsChartContainer');
    goalsContainer.innerHTML = '';
    allData.goals?.forEach(goal => {
        const chartDiv = document.createElement('div');
        chartDiv.innerHTML = `<div class="h-48"><canvas id="goal-chart-${goal.id}"></canvas></div><p class="mt-2 text-sm font-semibold">${goal.name}</p>`;
        goalsContainer.appendChild(chartDiv);
        new Chart(document.getElementById(`goal-chart-${goal.id}`), {
            type: 'doughnut',
            data: { labels: ['Alcançado', 'Faltante'], datasets: [{ data: [goal.current, Math.max(0, goal.target - goal.current)], backgroundColor: ['#45B7D1', '#e5e7eb'] }] },
            options: { responsive: true, maintainAspectRatio: false }
        });
    });
}

function addEntryToDOM(type, item = {}) {
    const id = item.id || Date.now();
    
    const container = document.getElementById(`${type}List`);
    const entryDiv = document.createElement('div');
    entryDiv.className = 'item-entry';
    entryDiv.dataset.id = id;

    let fields = `<div class="flex-grow"><input type="text" value="${item.name || ''}" placeholder="Nome" class="item-name w-full p-1 form-input"></div>`;

    if(type === 'goals' || type === 'cards') {
        const currentPlaceholder = (type === 'goals') ? 'Atual' : 'Fatura';
        const targetPlaceholder = (type === 'goals') ? 'Meta' : 'Limite';
        fields += `<div class="flex-grow"><input type="number" value="${item.current || ''}" placeholder="${currentPlaceholder}" class="item-current w-full p-1 form-input"></div>`;
        fields += `<span>/</span>`;
        fields += `<div class="flex-grow"><input type="number" value="${item.target || item.limit || ''}" placeholder="${targetPlaceholder}" class="item-${(type === 'goals') ? 'target' : 'limit'} w-full p-1 form-input"></div>`;
    } else { // incomes, expenses, subscriptions
        fields += `<div class="flex-grow"><input type="number" value="${item.value || ''}" placeholder="Valor" class="item-value w-full p-1 form-input"></div>`;
    }
    
    entryDiv.innerHTML = `${fields}<button class="removeItemBtn">&times;</button>`;
    container.appendChild(entryDiv);
}

function setupEventListeners() {
    document.body.addEventListener('click', (e) => {
        if (e.target.classList.contains('addItemBtn')) {
            addEntryToDOM(e.target.dataset.type);
        }
        if (e.target.classList.contains('removeItemBtn')) {
            e.target.closest('.item-entry').remove();
        }
    });
    
    document.getElementById('saveChangesBtn').addEventListener('click', saveDataToFirestore);
    themeToggleBtn.addEventListener('click', () => applyTheme(document.documentElement.classList.contains('dark') ? 'light' : 'dark'));
}

// --- Funções de UI e Utilidades ---
function formatCurrency(value) { return (value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
function showAuthUI() { authOverlay.style.display = 'flex'; }
function hideAuthUI() { authOverlay.style.display = 'none'; }
function hideLoading() {
    loadingOverlay.style.opacity = '0';
    setTimeout(() => {
        loadingOverlay.style.display = 'none';
        appWrapper.style.display = 'flex';
    }, 300);
}

// --- PONTO DE ENTRADA ---
function main() {
    setupNavigation();
    initializeCharts();
    setupAuthUI();
    setupEventListeners();
    
    onAuthStateChanged(auth, (user) => {
        if (user) {
            state.currentUser = user;
            hideAuthUI();
            setupFirestoreListener(user);
        } else {
            state.currentUser = null;
            if(state.unsubscribe) state.unsubscribe();
            appWrapper.style.display = 'none';
            showAuthUI();
            loadingOverlay.style.display = 'none';
        }
    });
}

main();
