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
const appContent = document.getElementById('appContent');
const authError = document.getElementById('authError');
const themeToggleBtn = document.getElementById('themeToggleBtn');

// --- Estado da Aplicação ---
let state = {
    currentUser: null,
    financialData: {},
    charts: {},
    unsubscribe: null,
};

// --- LÓGICA DE AUTENTICAÇÃO ---
function setupAuthUI() {
    // Listeners de Email/Senha
    document.getElementById('registerBtn').addEventListener('click', async () => {
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        authError.textContent = '';
        try {
            await createUserWithEmailAndPassword(auth, email, password);
        } catch (error) { authError.textContent = "Erro ao registrar: " + error.message; }
    });

    document.getElementById('loginBtn').addEventListener('click', async () => {
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        authError.textContent = '';
        try {
            await signInWithEmailAndPassword(auth, email, password);
        } catch (error) { authError.textContent = "Erro ao entrar: " + error.message; }
    });
    
    // Logout
    document.getElementById('logoutBtn').addEventListener('click', () => signOut(auth));
}

// --- LÓGICA DE DADOS (FIRESTORE) ---
async function setupFirestoreListener(user) {
    const financialDataRef = doc(db, `financial_planners/${user.uid}/data`, 'main');
    if (state.unsubscribe) state.unsubscribe();

    state.unsubscribe = onSnapshot(financialDataRef, (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            state.financialData = data;
            renderUI(data);
        } else {
            console.log("Documento não encontrado! Criando com dados iniciais.");
            createInitialDocument(financialDataRef);
        }
        hideLoading();
    }, (error) => {
        console.error("Erro ao carregar dados:", error);
        alert("Não foi possível carregar seus dados.");
    });
}

async function createInitialDocument(docRef) {
    const initialData = {
        theme: 'light',
        incomes: [{ id: Date.now(), name: 'Salário', value: 2500 }],
        expenses: [{ id: Date.now(), name: 'Aluguel', value: 800 }],
        goals: [{ id: Date.now(), name: 'Viagem para a Praia', target: 3000, current: 200 }],
    };
    await setDoc(docRef, initialData);
}

async function saveDataToFirestore() {
    document.getElementById('saveChangesBtn').disabled = true;
    const dataToSave = {
        theme: document.documentElement.classList.contains('dark') ? 'dark' : 'light',
        incomes: [], expenses: [], goals: []
    };

    document.querySelectorAll('#incomesList .item-entry').forEach(entry => dataToSave.incomes.push({ id: entry.dataset.id, name: entry.querySelector('.item-name').value, value: parseFloat(entry.querySelector('.item-value').value) || 0 }));
    document.querySelectorAll('#expensesList .item-entry').forEach(entry => dataToSave.expenses.push({ id: entry.dataset.id, name: entry.querySelector('.item-name').value, value: parseFloat(entry.querySelector('.item-value').value) || 0 }));
    document.querySelectorAll('#goalsList .item-entry').forEach(entry => dataToSave.goals.push({ id: entry.dataset.id, name: entry.querySelector('.item-name').value, target: parseFloat(entry.querySelector('.item-target').value) || 0, current: parseFloat(entry.querySelector('.item-current').value) || 0 }));
    
    const financialDataRef = doc(db, `financial_planners/${state.currentUser.uid}/data`, 'main');
    try {
        await setDoc(financialDataRef, dataToSave);
        const saveMessage = document.getElementById('saveMessage');
        saveMessage.textContent = 'Dados salvos na nuvem!';
        setTimeout(() => { saveMessage.textContent = ''; }, 3000);
    } catch (error) {
        console.error("Erro ao salvar:", error);
        alert("Falha ao salvar os dados.");
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
    const themeBtn = document.getElementById('themeToggleBtn');
    if (theme === 'dark') {
        html.classList.add('dark');
        html.classList.remove('light');
        themeBtn.textContent = '☀️';
    } else {
        html.classList.add('light');
        html.classList.remove('dark');
        themeBtn.textContent = '🌙';
    }
}

function renderDynamicLists(data) {
    const lists = { incomes: 'incomesList', expenses: 'expensesList', goals: 'goalsList' };
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

// --- LÓGICA DOS GRÁFICOS ---
function initializeCharts() {
    const budgetCanvas = document.getElementById('budgetChart');
    if(budgetCanvas) {
        state.charts.budget = new Chart(budgetCanvas, {
            type: 'doughnut',
            data: { labels: ['Rendas', 'Despesas', 'Sobra'], datasets: [{ data: [], backgroundColor: ['#4ECDC4', '#FF6B6B', '#45B7D1'] }] },
            options: { responsive: true, maintainAspectRatio: false }
        });
    }
}

function renderCharts({ incomeTotal, expenseTotal, surplus, allData }) {
    // Orçamento
    if(state.charts.budget) {
        state.charts.budget.data.datasets[0].data = [incomeTotal, expenseTotal, Math.max(0, surplus)];
        state.charts.budget.update();
    }
    // Metas
    const goalsContainer = document.getElementById('goalsChartContainer');
    goalsContainer.innerHTML = ''; // Limpa gráficos antigos
    allData.goals?.forEach(goal => {
        const chartDiv = document.createElement('div');
        chartDiv.className = 'text-center';
        chartDiv.innerHTML = `<div class="chart-container h-64 mx-auto"><canvas id="goal-chart-${goal.id}"></canvas></div><p class="mt-2 font-semibold">${goal.name}</p>`;
        goalsContainer.appendChild(chartDiv);
        
        new Chart(document.getElementById(`goal-chart-${goal.id}`), {
            type: 'doughnut',
            data: { labels: ['Alcançado', 'Faltante'], datasets: [{ data: [goal.current, Math.max(0, goal.target - goal.current)], backgroundColor: ['#45B7D1', '#e5e7eb'] }] },
            options: { responsive: true, maintainAspectRatio: false }
        });
    });
}

// --- MANIPULAÇÃO DINÂMICA DO DOM ---
function addEntryToDOM(type, item = {}) {
    const id = item.id || Date.now();
    const name = item.name || '';
    const value = item.value || '';
    const target = item.target || '';
    const current = item.current || '';

    const container = document.getElementById(`${type}List`);
    const entryDiv = document.createElement('div');
    entryDiv.className = 'item-entry flex items-center gap-2 p-2 bg-slate-100 dark:bg-slate-700 rounded-md';
    entryDiv.dataset.id = id;

    let fields = `<div class="flex-grow"><input type="text" value="${name}" placeholder="Nome" class="item-name w-full text-sm p-1 rounded-md border-slate-300 dark:border-slate-600 dark:bg-slate-600"></div>`;
    if(type === 'goals') {
        fields += `<div class="flex-grow"><input type="number" value="${current}" placeholder="Atual" class="item-current w-full text-sm p-1 rounded-md border-slate-300 dark:border-slate-600 dark:bg-slate-600"></div>`;
        fields += `<span class="text-slate-400">/</span>`;
        fields += `<div class="flex-grow"><input type="number" value="${target}" placeholder="Meta" class="item-target w-full text-sm p-1 rounded-md border-slate-300 dark:border-slate-600 dark:bg-slate-600"></div>`;
    } else {
        fields += `<div class="flex-grow"><input type="number" value="${value}" placeholder="Valor" class="item-value w-full text-sm p-1 rounded-md border-slate-300 dark:border-slate-600 dark:bg-slate-600"></div>`;
    }
    
    entryDiv.innerHTML = `${fields}<button type="button" class="removeItemBtn text-red-500 hover:text-red-700 font-bold p-1 rounded-full">&times;</button>`;
    container.appendChild(entryDiv);
}

// --- EVENT LISTENERS ---
function setupEventListeners() {
    document.getElementById('edit-data').addEventListener('click', (e) => {
        if (e.target.classList.contains('addItemBtn')) {
            addEntryToDOM(e.target.dataset.type);
        }
        if (e.target.classList.contains('removeItemBtn')) {
            e.target.closest('.item-entry').remove();
        }
    });
    
    document.getElementById('saveChangesBtn').addEventListener('click', saveDataToFirestore);
    
    themeToggleBtn.addEventListener('click', () => {
        const newTheme = document.documentElement.classList.contains('dark') ? 'light' : 'dark';
        applyTheme(newTheme);
        // O salvamento do tema ocorre junto com os outros dados
    });
}

// --- Funções de UI e Utilidades ---
function formatCurrency(value) { return (value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
function showAuthUI() { authOverlay.style.display = 'flex'; }
function hideAuthUI() { authOverlay.style.display = 'none'; }
function hideLoading(showApp = true) {
    loadingOverlay.style.opacity = '0';
    setTimeout(() => {
        loadingOverlay.style.display = 'none';
        if (showApp) {
            appContent.style.display = 'block';
        }
    }, 300);
}

// --- PONTO DE ENTRADA ---
function main() {
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
            showAuthUI();
            hideLoading(false);
        }
    });
}

main();
