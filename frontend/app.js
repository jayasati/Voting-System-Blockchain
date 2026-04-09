import { ethers } from "https://cdnjs.cloudflare.com/ajax/libs/ethers/6.7.0/ethers.min.js";

const CONTRACT_ADDRESS = "0x5fbdb2315678afecb367f032d93f642f64180aa3";
const abi = await fetch("./voting.json").then(r => r.json());

let provider, signer, contract, userAddress, ownerAddress;

const connectBtn        = document.getElementById("connect-btn");
const walletInfo        = document.getElementById("wallet-info");
const roleBadge         = document.getElementById("role-badge");
const statusDiv         = document.getElementById("status");
const container         = document.getElementById("candidates-container");
const winnerName        = document.getElementById("winner-name");
const winnerVotes       = document.getElementById("winner-votes");
const refreshBtn        = document.getElementById("refresh-btn");
const statusBadge       = document.getElementById("status-badge");
const voteStatusBar     = document.getElementById("vote-status-bar");
const ownerPanel        = document.getElementById("owner-panel");
const addCandidateBtn   = document.getElementById("add-candidate-btn");
const newCandidateInput = document.getElementById("new-candidate-input");
const toggleVotingBtn   = document.getElementById("toggle-voting-btn");
const txList            = document.getElementById("tx-list");

// ── Connect ───────────────────────────────────────────────────
connectBtn.addEventListener("click", async () => {
  if (!window.ethereum) { setStatus("MetaMask not found!", "red"); return; }
  try {
    provider    = new ethers.BrowserProvider(window.ethereum);
    await provider.send("eth_requestAccounts", []);
    signer      = await provider.getSigner();
    userAddress = await signer.getAddress();
    contract    = new ethers.Contract(CONTRACT_ADDRESS, abi, signer);
    ownerAddress= await contract.owner();

    const isOwner = userAddress.toLowerCase() === ownerAddress.toLowerCase();

    walletInfo.textContent  = `🦊 ${userAddress.slice(0,6)}...${userAddress.slice(-4)}`;
    connectBtn.textContent  = "✅ Connected";
    connectBtn.disabled     = true;
    roleBadge.style.display = "inline-block";
    roleBadge.textContent   = isOwner ? "👑 Admin" : "🗳️ Voter";
    roleBadge.className     = isOwner ? "role-admin" : "role-voter";

    if (isOwner) ownerPanel.style.display = "block";

    await refreshAll();
    listenToEvents();
  } catch (err) { setStatus("❌ " + err.message.slice(0,100), "red"); }
});

// ── Refresh all ───────────────────────────────────────────────
async function refreshAll() {
  await loadVotingStatus();
  await loadCandidates();
  await loadWinner();
  await checkIfVoted();
}

// ── Voting status badge ───────────────────────────────────────
async function loadVotingStatus() {
  const active = await contract.votingActive();
  statusBadge.textContent = active ? "● Voting Active" : "● Voting Paused";
  statusBadge.className   = `badge ${active ? "active" : "inactive"}`;
  toggleVotingBtn.textContent = active ? "⏸ Pause Voting" : "▶ Resume Voting";
}

// ── Check voted status ────────────────────────────────────────
async function checkIfVoted() {
  const voted = await contract.hasVoted(userAddress);
  voteStatusBar.textContent = voted
    ? "✅ You have already voted"
    : "🗳️ You have not voted yet";
  document.querySelectorAll(".vote-btn").forEach(b => { if (voted) b.disabled = true; });
}

// ── Load candidates ───────────────────────────────────────────
async function loadCandidates() {
  container.innerHTML = "";
  const count = await contract.candidatesCount();
  if (count == 0) {
    container.innerHTML = `<p style="color:#555">No candidates yet.</p>`;
    return;
  }
  let totalVotes = 0n;
  const data = [];
  for (let i = 1; i <= count; i++) {
    const [name, votes] = await contract.getCandidate(i);
    totalVotes += votes;
    data.push({ name, votes, id: i });
  }
  data.forEach(({ name, votes, id }) => {
    const pct = totalVotes > 0n ? Number((votes * 100n) / totalVotes) : 0;
    container.appendChild(createCard(name, votes, id, pct));
  });
}

// ── Candidate card ────────────────────────────────────────────
function createCard(name, votes, id, pct) {
  const card = document.createElement("div");
  card.className = "candidate-card";
  card.innerHTML = `
    <div class="candidate-name">${name}</div>
    <div class="vote-count">${votes.toString()}<span>votes</span></div>
    <div class="vote-bar"><div class="vote-bar-fill" style="width:${pct}%"></div></div>
    <button class="vote-btn" id="vote-${id}">🗳️ Vote · ${pct}%</button>
  `;
  card.querySelector(`#vote-${id}`).addEventListener("click", () => castVote(id));
  return card;
}

// ── Cast vote ─────────────────────────────────────────────────
async function castVote(id) {
  try {
    setStatus("⏳ Confirm in MetaMask...", "yellow");
    const tx = await contract.vote(id);
    setStatus("⏳ Waiting for block...", "yellow");
    await tx.wait();
    setStatus("✅ Vote cast!", "green");
    logTx(tx.hash, `Voted for #${id}`);
    await refreshAll();
  } catch (err) {
    if (err.message.includes("Already voted"))   setStatus("❌ Already voted!", "red");
    else if (err.message.includes("not active")) setStatus("❌ Voting is paused!", "red");
    else setStatus("❌ " + err.message.slice(0, 80), "red");
  }
}

// ── Load winner ───────────────────────────────────────────────
async function loadWinner() {
  try {
    const [name, votes] = await contract.getWinner();
    winnerName.textContent  = name;
    winnerVotes.textContent = `with ${votes.toString()} vote(s)`;
  } catch {
    winnerName.textContent  = "No votes yet";
    winnerVotes.textContent = "";
  }
}

// ── Owner: Add candidate ──────────────────────────────────────
addCandidateBtn.addEventListener("click", async () => {
  const name = newCandidateInput.value.trim();
  if (!name) { setStatus("Enter a name!", "red"); return; }
  try {
    setStatus("⏳ Adding...", "yellow");
    const tx = await contract.addCandidate(name);
    await tx.wait();
    newCandidateInput.value = "";
    setStatus(`✅ ${name} added!`, "green");
    logTx(tx.hash, `Added: ${name}`);
    await loadCandidates();
  } catch (err) { setStatus("❌ " + err.message.slice(0,80), "red"); }
});

// ── Owner: Toggle voting ──────────────────────────────────────
toggleVotingBtn.addEventListener("click", async () => {
  try {
    setStatus("⏳ Toggling...", "yellow");
    const tx = await contract.toggleVoting();
    await tx.wait();
    logTx(tx.hash, "Toggled voting");
    await loadVotingStatus();
    setStatus("✅ Status updated!", "green");
  } catch (err) { setStatus("❌ " + err.message.slice(0,80), "red"); }
});

// ── Live events ───────────────────────────────────────────────
function listenToEvents() {
  contract.on("VoteCast", async () => { await loadCandidates(); await loadWinner(); });
}

// ── Refresh ───────────────────────────────────────────────────
refreshBtn.addEventListener("click", async () => {
  if (!contract) { setStatus("Connect wallet first!", "red"); return; }
  await refreshAll();
  setStatus("✅ Refreshed!", "green");
});

// ── TX log ────────────────────────────────────────────────────
function logTx(hash, label) {
  const li = document.createElement("li");
  li.innerHTML = `<span>${label}</span> — ${hash.slice(0,22)}...`;
  if (txList.firstChild?.textContent === "No transactions yet") txList.innerHTML = "";
  txList.prepend(li);
}

// ── Status ────────────────────────────────────────────────────
function setStatus(msg, color) {
  statusDiv.textContent = msg;
  statusDiv.style.color =
    color === "green"  ? "#34d399" :
    color === "yellow" ? "#fbbf24" :
    color === "red"    ? "#f87171" : "#888";
}