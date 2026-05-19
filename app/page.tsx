'use client';

import { useState, useEffect, useCallback } from 'react';
import type { BrowserProvider } from 'ethers';
import { ethers, Contract, formatUnits, parseUnits } from 'ethers';
import { Wallet, Shield, CheckCircle2, XCircle, FileText, ArrowRight, Layers, AlertCircle } from 'lucide-react';

// ============================================================================
// CONSTANTS & TYPES
// ============================================================================

const ARC_TESTNET_CHAIN_ID = 5042002;
const CONTRACT_ADDRESS = '0x562c5b127d7B378BbDB3fA1168BD6775Ba5f29d6';

interface Project {
  id: number;
  client: string;
  freelancer: string;
  totalAmount: string;
  releasedAmount: string;
  cancelled: boolean;
  milestones: Array<{ amount: string; released: boolean }>;
}

interface FormState {
  freelancerAddress: string;
  totalAmount: string;
  projectIdToCancel: string;
  projectIdToRelease: string;
  milestoneIndexToRelease: string;
}

const CONTRACT_ABI = [
  {
    inputs: [
      { internalType: 'address', name: '_freelancer', type: 'address' },
      { internalType: 'uint256', name: '_totalAmount', type: 'uint256' }
    ],
    name: 'createProject',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    inputs: [{ internalType: 'uint256', name: '_projectId', type: 'uint256' }],
    name: 'cancelProject',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    inputs: [
      { internalType: 'uint256', name: '_projectId', type: 'uint256' },
      { internalType: 'uint256', name: '_milestoneIndex', type: 'uint256' }
    ],
    name: 'releaseMilestone',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    inputs: [{ internalType: 'uint256', name: '_projectId', type: 'uint256' }],
    name: 'getProject',
    outputs: [
      {
        components: [
          { internalType: 'address', name: 'client', type: 'address' },
          { internalType: 'address', name: 'freelancer', type: 'address' },
          { internalType: 'contract IERC20', name: 'usdc', type: 'address' },
          { internalType: 'uint256', name: 'totalAmount', type: 'uint256' },
          { internalType: 'uint256', name: 'releasedAmount', type: 'uint256' },
          { internalType: 'bool', name: 'cancelled', type: 'bool' },
          {
            components: [
              { internalType: 'uint256', name: 'amount', type: 'uint256' },
              { internalType: 'bool', name: 'released', type: 'bool' }
            ],
            internalType: 'struct ArcMilestone.Milestone',
            name: 'milestones',
            type: 'tuple'
          }
        ],
        internalType: 'struct ArcMilestone.Project',
        name: '',
        type: 'tuple'
      }
    ],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [],
    name: 'getTotalProjects',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  }
] as const;

// ============================================================================
// MAIN PAGE COMPONENT WITH INLINE COMPONENTS
// ============================================================================

export default function Home() {
  const [activeTab, setActiveTab] = useState<'client' | 'freelancer'>('client');
  const [isWalletConnected, setIsWalletConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [provider, setProvider] = useState<BrowserProvider | null>(null);
  const [contract, setContract] = useState<Contract | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  // Global UI States shared across sub-sections
  const [projects, setProjects] = useState<Project[]>([]);
  const [txLoading, setTxLoading] = useState(false);
  const [txError, setTxError] = useState<string | null>(null);
  const [txSuccess, setTxSuccess] = useState<string | null>(null);

  const [formData, setFormData] = useState<FormState>({
    freelancerAddress: '',
    totalAmount: '',
    projectIdToCancel: '',
    projectIdToRelease: '',
    milestoneIndexToRelease: ''
  });

  const fetchProjects = useCallback(async () => {
    if (!contract) return;
    try {
      const totalProjects = await (contract as any).getTotalProjects();
      const projectList: Project[] = [];

      for (let i = 0; i < Number(totalProjects); i++) {
        const projectData = await (contract as any).getProject(i);
        const [client, freelancer, , totalAmount, releasedAmount, cancelled, milestones] = projectData;

        projectList.push({
          id: i,
          client: client as string,
          freelancer: freelancer as string,
          totalAmount: formatUnits(totalAmount as bigint, 6),
          releasedAmount: formatUnits(releasedAmount as bigint, 6),
          cancelled: cancelled as boolean,
          milestones: (milestones as Array<{ amount: bigint; released: boolean }>).map((m) => ({
            amount: formatUnits(m.amount, 6),
            released: m.released
          }))
        });
      }
      setProjects(projectList);
    } catch (err) {
      console.error('Error fetching projects:', err);
    }
  }, [contract]);

  useEffect(() => {
    if (isWalletConnected) {
      fetchProjects();
      const interval = setInterval(fetchProjects, 8000);
      return () => clearInterval(interval);
    }
  }, [isWalletConnected, fetchProjects]);

  const handleConnectWallet = async () => {
    setIsConnecting(true);
    setConnectionError(null);
    try {
      if (typeof window === 'undefined' || !(window as any).ethereum) {
        throw new Error('Please install MetaMask or Rabby wallet.');
      }
      const ethereum = (window as any).ethereum;
      const accounts = await ethereum.request({ method: 'eth_requestAccounts' });
      const browserProvider = new ethers.BrowserProvider(ethereum);
      const network = await browserProvider.getNetwork();

      if (Number(network.chainId) !== ARC_TESTNET_CHAIN_ID) {
        await ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: `0x${ARC_TESTNET_CHAIN_ID.toString(16)}` }]
        });
      }

      setWalletAddress(accounts);
      setProvider(browserProvider);
      setContract(new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, browserProvider));
      setIsWalletConnected(true);
    } catch (error: any) {
      setConnectionError(error?.message || 'Connection failed');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleCreateProject = async () => {
    if (!contract || !provider) return;
    try {
      setTxLoading(true); setTxError(null); setTxSuccess(null);
      const totalAmount = parseUnits(formData.totalAmount, 6);
      const signer = await provider.getSigner();
      const tx = await (contract.connect(signer) as any).createProject(formData.freelancerAddress, totalAmount);
      setTxSuccess('Vault configuration processing on-chain...');
      await tx.wait();
      setTxSuccess('Secure Milestone Vault deployed successfully!');
      setFormData(prev => ({ ...prev, freelancerAddress: '', totalAmount: '' }));
      fetchProjects();
    } catch (err: any) { setTxError(err?.message || 'Transaction failed'); } finally { setTxLoading(false); }
  };

  const handleReleaseMilestone = async () => {
    if (!contract || !provider) return;
    try {
      setTxLoading(true); setTxError(null); setTxSuccess(null);
      const signer = await provider.getSigner();
      const tx = await (contract.connect(signer) as any).releaseMilestone(formData.projectIdToRelease, formData.milestoneIndexToRelease);
      setTxSuccess('Releasing escrow allocation...');
      await tx.wait();
      setTxSuccess('Milestone payout settled completely!');
      setFormData(prev => ({ ...prev, projectIdToRelease: '', milestoneIndexToRelease: '' }));
      fetchProjects();
    } catch (err: any) { setTxError(err?.message || 'Payout failed'); } finally { setTxLoading(false); }
  };

  const handleCancelProject = async (id: number) => {
    if (!contract || !provider) return;
    try {
      setTxLoading(true); setTxError(null); setTxSuccess(null);
      const signer = await provider.getSigner();
      const tx = await (contract.connect(signer) as any).cancelProject(id);
      setTxSuccess('Processing early cancellation protocols...');
      await tx.wait();
      setTxSuccess('Project terminated. Remaining balance split executed.');
      fetchProjects();
    } catch (err: any) { setTxError(err?.message || 'Cancellation failed'); } finally { setTxLoading(false); }
  };

  return (
    <div className="min-h-screen bg-[#0B0F19] text-[#E2E8F0] font-sans selection:bg-teal-500/30 selection:text-teal-200">
      {/* GLOW BACKGROUND EFFECT */}
      <div className="absolute top-0 left-1/4 h-[500px] w-[500px] rounded-full bg-teal-500/5 blur-[120px] pointer-events-none" />
      <div className="absolute top-1/3 right-1/4 h-[400px] w-[400px] rounded-full bg-blue-500/5 blur-[100px] pointer-events-none" />

      {/* NAVBAR */}
      <nav className="sticky top-0 z-50 border-b border-slate-800/60 bg-[#0B0F19]/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-teal-400 to-blue-600 shadow-md shadow-teal-500/20">
              <Shield className="h-5 w-5 text-white" />
            </div>
            <div>
              <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">ArcMilestone</span>
              <span className="ml-2 rounded-full border border-teal-500/30 bg-teal-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-teal-400">Protocol</span>
            </div>
          </div>
          {isWalletConnected && walletAddress ? (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 rounded-xl border border-slate-800 bg-[#131B2E] px-4 py-2 font-mono text-xs font-semibold text-slate-300 shadow-inner">
                <div className="h-2 w-2 rounded-full bg-teal-400 animate-pulse" />
                {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
              </div>
              <button onClick={() => setIsWalletConnected(false)} className="rounded-xl border border-red-500/20 bg-red-500/5 px-3 py-2 text-xs font-medium text-red-400 transition hover:bg-red-500/10">Disconnect</button>
            </div>
          ) : (
            <button onClick={handleConnectWallet} className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-teal-500 to-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-95 shadow-lg shadow-teal-500/10"><Wallet className="h-4 w-4" /> Connect Wallet</button>
          )}
        </div>
      </nav>

      <main className="mx-auto max-w-7xl px-6 py-12">
        {!isWalletConnected ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <h1 className="text-5xl font-extrabold tracking-tight text-white lg:text-6xl max-w-2xl leading-tight">Secure Payouts.<br /><span className="bg-gradient-to-r from-teal-400 to-blue-500 bg-clip-text text-transparent">Build Unbounded Trust.</span></h1>
            <p className="mt-6 max-w-lg text-base text-slate-400 leading-relaxed">Automate professional freelance agreements on Arc Network. Milestone tracking protection mechanisms with built-in instant client escrow dispute handling.</p>
            {connectionError && <div className="mt-6 flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-400"><AlertCircle className="h-4 w-4" /> {connectionError}</div>}
            <button onClick={handleConnectWallet} disabled={isConnecting} className="mt-10 flex items-center gap-2 rounded-xl bg-gradient-to-r from-teal-500 via-teal-600 to-blue-600 px-8 py-3.5 text-base font-bold text-white shadow-xl shadow-teal-500/10 transition hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50">{isConnecting ? 'Initializing Stack...' : 'Enter App Dashboard'}</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* LEFT INPUT CONTROLS */}
            <div className="lg:col-span-5 space-y-6">
              {/* INTERFACE SELECTOR */}
              <div className="flex p-1 rounded-xl bg-[#111827] border border-slate-800/80">
                <button onClick={() => setActiveTab('client')} className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold rounded-lg transition-all ${activeTab === 'client' ? 'bg-[#1F2937] text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}>Client Dashboard</button>
                <button onClick={() => setActiveTab('freelancer')} className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold rounded-lg transition-all ${activeTab === 'freelancer' ? 'bg-[#1F2937] text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}>Freelancer Hub</button>
              </div>

              {/* ACTION TRANSACTION RESPONSES */}
              {(txError || txSuccess) && (
                <div className={`p-4 rounded-xl border text-sm flex items-start gap-3 ${txError ? 'bg-red-500/5 border-red-500/20 text-red-400' : 'bg-teal-500/5 border-teal-500/20 text-teal-400'}`}>
                  {txError ? <XCircle className="h-5 w-5 mt-0.5 shrink-0" /> : <CheckCircle2 className="h-5 w-5 mt-0.5 shrink-0" />}
                  <div>{txError || txSuccess}</div>
                </div>
              )}

              {/* DYNAMIC FORM VIEWS */}
              {activeTab === 'client' ? (
                <div className="rounded-2xl border border-slate-800/80 bg-[#111827]/50 p-6 backdrop-blur-sm shadow-xl">
                  <div className="flex items-center gap-2 mb-6"><FileText className="h-5 w-5 text-teal-400" /><h2 className="text-lg font-bold text-white">Deploy Secure Escrow</h2></div>
                  <div className="space-y-4">
                    <div>
                      <label className="text-xs font-semibold tracking-wider uppercase text-slate-400">Freelancer Account Address</label>
                      <input type="text" placeholder="0x..." value={formData.freelancerAddress} onChange={(e) => setFormData({ ...formData, freelancerAddress: e.target.value })} className="mt-2 w-full rounded-xl border border-slate-800 bg-[#090D16] px-4 py-3 font-mono text-sm text-white placeholder-slate-600 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold tracking-wider uppercase text-slate-400">Total Project Allocation (USDC)</label>
                      <input type="number" placeholder="0.00" value={formData.totalAmount} onChange={(e) => setFormData({ ...formData, totalAmount: e.target.value })} className="mt-2 w-full rounded-xl border border-slate-800 bg-[#090D16] px-4 py-3 text-sm text-white placeholder-slate-600 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500" />
                    </div>
                    <div className="pt-2">
                      <div className="rounded-xl bg-[#1F2937]/30 border border-slate-800/50 p-3 mb-4 text-xs text-slate-400 leading-normal">Funds will automatically split into 3 locked release milestones:<br /><span className="text-teal-400 font-medium">M1: 30% • M2: 40% • M3: 30%</span></div>
                      <button onClick={handleCreateProject} disabled={txLoading} className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-teal-500 to-teal-600 py-3.5 text-sm font-bold text-white shadow-lg shadow-teal-500/10 transition hover:opacity-95 disabled:opacity-40">{txLoading ? 'Signing Protocol...' : 'Initialize Contract Vault'}</button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-slate-800/80 bg-[#111827]/50 p-6 backdrop-blur-sm shadow-xl">
                  <div className="flex items-center gap-2 mb-6"><Layers className="h-5 w-5 text-blue-400" /><h2 className="text-lg font-bold text-white">Settle Active Payouts</h2></div>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-semibold tracking-wider uppercase text-slate-400">Project Index ID</label>
                        <input type="number" placeholder="0" value={formData.projectIdToRelease} onChange={(e) => setFormData({ ...formData, projectIdToRelease: e.target.value })} className="mt-2 w-full rounded-xl border border-slate-800 bg-[#090D16] px-4 py-3 text-sm text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                      </div>
                      <div>
                        <label className="text-xs font-semibold tracking-wider uppercase text-slate-400">Milestone Index</label>
                        <input type="number" placeholder="0 - 2" min="0" max="2" value={formData.milestoneIndexToRelease} onChange={(e) => setFormData({ ...formData, milestoneIndexToRelease: e.target.value })} className="mt-2 w-full rounded-xl border border-slate-800 bg-[#090D16] px-4 py-3 text-sm text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                      </div>
                    </div>
                    <button onClick={handleReleaseMilestone} disabled={txLoading} className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 py-3.5 text-sm font-bold text-white shadow-lg shadow-blue-500/10 transition hover:opacity-95 disabled:opacity-40">{txLoading ? 'Releasing Funds...' : 'Execute Milestone Release'}</button>
                  </div>
                </div>
              )}
            </div>

            {/* RIGHT SIDE DATA DISPLAY */}
            <div className="lg:col-span-7 space-y-6">
              <div className="flex items-center justify-between"><h2 className="text-xl font-bold tracking-tight text-white">Active Ledger Protocols</h2><span className="text-xs text-slate-500 font-medium font-mono">Live Sync Engine Enabled</span></div>

              {projects.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-800 p-12 text-center text-slate-500"><Layers className="h-8 w-8 mx-auto stroke-[1.5] text-slate-600 mb-3" /> No network projects active on this wallet address yet.</div>
              ) : (
                <div className="space-y-4">
                  {projects.map((project) => {
                    const isClient = project.client.toLowerCase() === walletAddress?.toLowerCase();
                    const isFreelancer = project.freelancer.toLowerCase() === walletAddress?.toLowerCase();
                    if (!isClient && !isFreelancer) return null;

                    return (
                      <div key={project.id} className={`rounded-2xl border bg-[#111827]/30 p-5 backdrop-blur-sm transition shadow-md ${project.cancelled ? 'border-red-500/20 opacity-60' : 'border-slate-800/80 hover:border-slate-700/80'}`}>
                        <div className="flex items-start justify-between mb-4">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold text-white font-mono">Project Ledger #{project.id}</span>
                              {project.cancelled && <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-bold uppercase text-red-400">Terminated</span>}
                            </div>
                            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
                              <span className="font-mono">Client: {project.client.slice(0,4)}...{project.client.slice(-4)}</span>
                              <ArrowRight className="h-3 w-3 text-slate-600" />
                              <span className="font-mono">Freelancer: {project.freelancer.slice(0,4)}...{project.freelancer.slice(-4)}</span>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-xs text-slate-400">Total Secured</div>
                            <div className="text-base font-extrabold text-white font-mono mt-0.5">${project.totalAmount} <span className="text-[10px] text-slate-400 font-normal">USDC</span></div>
                          </div>
                        </div>

                        {/* MILESTONE PILLS TRACKER */}
                        <div className="grid grid-cols-3 gap-3 pt-3 border-t border-slate-800/40">
                          {project.milestones.map((m, idx) => (
                            <div key={idx} className={`rounded-xl border p-3 flex flex-col justify-between ${m.released ? 'bg-teal-500/5 border-teal-500/20' : 'bg-[#090D16]/60 border-slate-800/60'}`}>
                              <div>
                                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Milestone {idx + 1}</div>
                                <div className="text-xs font-bold text-white font-mono mt-1">${m.amount}</div>
                              </div>
                              <div className="mt-2.5 flex items-center gap-1.5">
                                <div className={`h-1.5 w-1.5 rounded-full ${m.released ? 'bg-teal-400' : 'bg-slate-600'}`} />
                                <span className={`text-[10px] font-semibold ${m.released ? 'text-teal-400' : 'text-slate-500'}`}>{m.released ? 'Settled' : 'Escrowed'}</span>
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* CLIENT CANCELLATION TRIGGER ACTION */}
                        {isClient && !project.cancelled && Number(project.releasedAmount) < Number(project.totalAmount) && (
                          <div className="mt-4 flex justify-end">
                            <button onClick={() => handleCancelProject(project.id)} disabled={txLoading} className="text-xs font-medium text-red-400 border border-red-500/10 bg-red-500/5 hover:bg-red-500/10 px-3 py-1.5 rounded-lg transition">Cancel Protocol (10% Security Fee)</button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
