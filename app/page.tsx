'use client';

import { useState, useEffect, useCallback } from 'react';
import type { BrowserProvider } from 'ethers';
import { ethers, Contract, formatUnits, parseUnits } from 'ethers';

// ============================================================================
// CONSTANTS & TYPES
// ============================================================================

const ARC_TESTNET_CHAIN_ID = 1329;
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
  milestone1: string;
  milestone2: string;
  milestone3: string;
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
            internalType: 'struct ArcMilestone.Milestone[3]',
            name: 'milestones',
            type: 'tuple[3]'
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
// NAVBAR COMPONENT
// ============================================================================

function Navbar({
  isConnected,
  walletAddress,
  onConnect,
  onDisconnect
}: {
  isConnected: boolean;
  walletAddress: string | null;
  onConnect: () => void;
  onDisconnect: () => void;
}) {
  return (
    <nav className="border-b border-slate-200 bg-white shadow-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2">
          <div className="text-2xl font-bold text-blue-600">⚡</div>
          <h1 className="text-xl font-bold text-slate-900">ArcMilestone</h1>
        </div>
        {isConnected && walletAddress ? (
          <div className="flex items-center gap-4">
            <div className="rounded-lg bg-blue-50 px-4 py-2 font-mono text-sm text-blue-700">
              {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
            </div>
            <button
              onClick={onDisconnect}
              className="rounded-lg bg-red-100 px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-200"
            >
              Disconnect
            </button>
          </div>
        ) : (
          <button
            onClick={onConnect}
            className="rounded-lg bg-blue-600 px-6 py-2 font-semibold text-white transition hover:bg-blue-700"
          >
            Connect Wallet
          </button>
        )}
      </div>
    </nav>
  );
}

// ============================================================================
// CLIENT VIEW COMPONENT
// ============================================================================

function ClientView({
  walletAddress,
  provider,
  contract
}: {
  walletAddress: string;
  provider: BrowserProvider | null;
  contract: Contract | null;
}) {
  const [formData, setFormData] = useState<FormState>({
    freelancerAddress: '',
    totalAmount: '',
    milestone1: '',
    milestone2: '',
    milestone3: '',
    projectIdToCancel: '',
    projectIdToRelease: '',
    milestoneIndexToRelease: ''
  });

  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const fetchProjects = useCallback(async () => {
    if (!contract) return;
    try {
      const totalProjects = await contract.getTotalProjects();
      const projectList: Project[] = [];

      for (let i = 0; i < Number(totalProjects); i++) {
        const projectData = await contract.getProject(i);
        const [client, freelancer, , totalAmount, releasedAmount, cancelled, milestones] =
          projectData;

        projectList.push({
          id: i,
          client: client as string,
          freelancer: freelancer as string,
          totalAmount: formatUnits(totalAmount as bigint, 6),
          releasedAmount: formatUnits(releasedAmount as bigint, 6),
          cancelled: cancelled as boolean,
          milestones: (milestones as Array<{ amount: bigint; released: boolean }>).map(
            (m) => ({
              amount: formatUnits(m.amount, 6),
              released: m.released
            })
          )
        });
      }

      setProjects(projectList);
    } catch (err) {
      console.error('Error fetching projects:', err);
      setError('Failed to fetch projects');
    }
  }, [contract]);

  useEffect(() => {
    fetchProjects();
    const interval = setInterval(fetchProjects, 10000);
    return () => clearInterval(interval);
  }, [fetchProjects]);

  const handleCreateProject = async () => {
    if (!contract || !provider) {
      setError('Contract or provider not initialized');
      return;
    }

    if (!formData.freelancerAddress || !formData.totalAmount) {
      setError('Please fill in all required fields');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setSuccess(null);

      const totalAmount = parseUnits(formData.totalAmount, 6);
      const signer = await provider.getSigner();
      const contractWithSigner = contract.connect(signer) as any;
      const tx = await contractWithSigner.createProject(
        formData.freelancerAddress,
        totalAmount
      );

      setSuccess('Transaction submitted! Waiting for confirmation...');
      await tx.wait();

      setSuccess('Project created successfully!');
      setFormData({
        ...formData,
        freelancerAddress: '',
        totalAmount: '',
        milestone1: '',
        milestone2: '',
        milestone3: ''
      });

      setTimeout(() => fetchProjects(), 1000);
    } catch (err: any) {
      setError(err?.message || 'Transaction failed');
    } finally {
      setLoading(false);
    }
  };

  const handleReleaseMilestone = async () => {
    if (!contract || !provider) {
      setError('Contract or provider not initialized');
      return;
    }

    if (!formData.projectIdToRelease || formData.milestoneIndexToRelease === '') {
      setError('Please enter project ID and milestone index');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setSuccess(null);

      const signer = await provider.getSigner();
      const contractWithSigner = contract.connect(signer) as any;

      const tx = await contractWithSigner.releaseMilestone(
        formData.projectIdToRelease,
        formData.milestoneIndexToRelease
      );

      setSuccess('Milestone release transaction submitted!');
      await tx.wait();

      setSuccess('Milestone released successfully!');
      setFormData({
        ...formData,
        projectIdToRelease: '',
        milestoneIndexToRelease: ''
      });

      setTimeout(() => fetchProjects(), 1000);
    } catch (err: any) {
      setError(err?.message || 'Failed to release milestone');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Create Project Section */}
      <div className="rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
        <h2 className="mb-6 text-2xl font-bold text-slate-900">Create New Project</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700">
              Freelancer Address
            </label>
            <input
              type="text"
              placeholder="0x..."
              value={formData.freelancerAddress}
              onChange={(e) =>
                setFormData({ ...formData, freelancerAddress: e.target.value })
              }
              className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-2 text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700">
              Total Amount (USDC)
            </label>
            <input
              type="number"
              placeholder="1000"
              step="0.01"
              value={formData.totalAmount}
              onChange={(e) =>
                setFormData({ ...formData, totalAmount: e.target.value })
              }
              className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-2 text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
          </div>

          <button
            onClick={handleCreateProject}
            disabled={loading}
            className="w-full rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white transition disabled:bg-slate-400 hover:bg-blue-700"
          >
            {loading ? 'Processing...' : 'Initialize Secure Vault'}
          </button>

          {error && <div className="rounded-lg bg-red-100 p-4 text-red-700">{error}</div>}
          {success && <div className="rounded-lg bg-green-100 p-4 text-green-700">{success}</div>}
        </div>
      </div>

      {/* Release Milestone Section */}
      <div className="rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
        <h2 className="mb-6 text-2xl font-bold text-slate-900">Release Milestone</h2>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700">
                Project ID
              </label>
              <input
                type="number"
                placeholder="0"
                value={formData.projectIdToRelease}
                onChange={(e) =>
                  setFormData({ ...formData, projectIdToRelease: e.target.value })
                }
                className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-2 text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700">
                Milestone Index (0-2)
              </label>
              <input
                type="number"
                placeholder="0"
                min="0"
                max="2"
                value={formData.milestoneIndexToRelease}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    milestoneIndexToRelease: e.target.value
                  })
                }
                className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-2 text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
            </div>
          </div>

          <button
            onClick={handleReleaseMilestone}
            disabled={loading}
            className="w-full rounded-lg bg-green-600 px-6 py-3 font-semibold text-white transition disabled:bg-slate-400 hover:bg-green-700"
          >
            {loading ? 'Processing...' : 'Release Milestone'}
          </button>
        </div>
      </div>

      {/* Active Projects */}
      <div className="rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
        <h2 className="mb-6 text-2xl font-bold text-slate-900">Active Projects</h2>

        {projects.length === 0 ? (
          <p className="text-slate-600">No projects yet.</p>
        ) : (
          <div className="space-y-4">
            {projects.map((project) => (
              <div
                key={project.id}
                className="rounded-lg border border-slate-200 bg-slate-50 p-4"
              >
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="font-semibold text-slate-900">Project #{project.id}</h3>
                  {project.cancelled && (
                    <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700">
                      Cancelled
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm text-slate-600">
                  <div>
                    <span className="font-semibold">Client:</span>{' '}
                    {project.client.slice(0, 6)}...{project.client.slice(-4)}
                  </div>
                  <div>
                    <span className="font-semibold">Freelancer:</span>{' '}
                    {project.freelancer.slice(0, 6)}...{project.freelancer.slice(-4)}
                  </div>
                  <div>
                    <span className="font-semibold">Total:</span> ${project.totalAmount}
                  </div>
                  <div>
                    <span className="font-semibold">Released:</span> ${project.releasedAmount}
                  </div>
                </div>
                <div className="mt-3 space-y-1">
                  {project.milestones.map((m, idx) => (
                    <div key={idx} className="text-xs text-slate-600">
                      Milestone {idx + 1}: ${m.amount}{' '}
                      {m.released ? (
                        <span className="font-semibold text-green-600">✓ Released</span>
                      ) : (
                        <span className="text-slate-400">Pending</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// FREELANCER VIEW COMPONENT
// ============================================================================

function FreelancerView({
  walletAddress,
  provider,
  contract
}: {
  walletAddress: string;
  provider: BrowserProvider | null;
  contract: Contract | null;
}) {
  const [formData, setFormData] = useState<FormState>({
    freelancerAddress: '',
    totalAmount: '',
    milestone1: '',
    milestone2: '',
    milestone3: '',
    projectIdToCancel: '',
    projectIdToRelease: '',
    milestoneIndexToRelease: ''
  });

  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const fetchProjects = useCallback(async () => {
    if (!contract) return;
    try {
      const totalProjects = await contract.getTotalProjects();
      const projectList: Project[] = [];

      for (let i = 0; i < Number(totalProjects); i++) {
        const projectData = await contract.getProject(i);
        const [client, freelancer, , totalAmount, releasedAmount, cancelled, milestones] =
          projectData;

        if ((freelancer as string).toLowerCase() === walletAddress.toLowerCase()) {
          projectList.push({
            id: i,
            client: client as string,
            freelancer: freelancer as string,
            totalAmount: formatUnits(totalAmount as bigint, 6),
            releasedAmount: formatUnits(releasedAmount as bigint, 6),
            cancelled: cancelled as boolean,
            milestones: (milestones as Array<{ amount: bigint; released: boolean }>).map(
              (m) => ({
                amount: formatUnits(m.amount, 6),
                released: m.released
              })
            )
          });
        }
      }

      setProjects(projectList);
    } catch (err) {
      console.error('Error fetching projects:', err);
      setError('Failed to fetch projects');
    }
  }, [contract, walletAddress]);

  useEffect(() => {
    fetchProjects();
    const interval = setInterval(fetchProjects, 10000);
    return () => clearInterval(interval);
  }, [fetchProjects]);

  const handleCancelProject = async () => {
    if (!contract || !provider) {
      setError('Contract or provider not initialized');
      return;
    }

    if (!formData.projectIdToCancel) {
      setError('Please enter project ID');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setSuccess(null);

      const signer = await provider.getSigner();
      const contractWithSigner = contract.connect(signer) as any;

      const tx = await contractWithSigner.cancelProject(formData.projectIdToCancel);

      setSuccess('Cancel transaction submitted!');
      await tx.wait();

      setSuccess('Project cancelled successfully!');
      setFormData({ ...formData, projectIdToCancel: '' });

      setTimeout(() => fetchProjects(), 1000);
    } catch (err: any) {
      setError(err?.message || 'Failed to cancel project');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Cancel Project Section */}
      <div className="rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
        <h2 className="mb-6 text-2xl font-bold text-slate-900">Manage Projects</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700">
              Project ID to Cancel
            </label>
            <input
              type="number"
              placeholder="0"
              value={formData.projectIdToCancel}
              onChange={(e) =>
                setFormData({ ...formData, projectIdToCancel: e.target.value })
              }
              className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-2 text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
          </div>

          <button
            onClick={handleCancelProject}
            disabled={loading}
            className="w-full rounded-lg bg-red-600 px-6 py-3 font-semibold text-white transition disabled:bg-slate-400 hover:bg-red-700"
          >
            {loading ? 'Processing...' : 'Cancel Project'}
          </button>

          {error && <div className="rounded-lg bg-red-100 p-4 text-red-700">{error}</div>}
          {success && <div className="rounded-lg bg-green-100 p-4 text-green-700">{success}</div>}
        </div>
      </div>

      {/* Your Projects */}
      <div className="rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
        <h2 className="mb-6 text-2xl font-bold text-slate-900">Your Projects</h2>

        {projects.length === 0 ? (
          <p className="text-slate-600">No projects assigned to you yet.</p>
        ) : (
          <div className="space-y-4">
            {projects.map((project) => (
              <div
                key={project.id}
                className="rounded-lg border border-slate-200 bg-slate-50 p-4"
              >
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="font-semibold text-slate-900">Project #{project.id}</h3>
                  {project.cancelled && (
                    <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700">
                      Cancelled
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm text-slate-600">
                  <div>
                    <span className="font-semibold">Client:</span>{' '}
                    {project.client.slice(0, 6)}...{project.client.slice(-4)}
                  </div>
                  <div>
                    <span className="font-semibold">Total:</span> ${project.totalAmount}
                  </div>
                  <div>
                    <span className="font-semibold">Released:</span> ${project.releasedAmount}
                  </div>
                </div>
                <div className="mt-3 space-y-1">
                  {project.milestones.map((m, idx) => (
                    <div key={idx} className="text-xs text-slate-600">
                      Milestone {idx + 1}: ${m.amount}{' '}
                      {m.released ? (
                        <span className="font-semibold text-green-600">✓ Released</span>
                      ) : (
                        <span className="text-slate-400">Pending</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// WEB3 CONNECTION UTILITY
// ============================================================================

async function connectWallet(): Promise<{
  address: string;
  provider: BrowserProvider;
} | null> {
  if (typeof window === 'undefined') return null;

  try {
    const ethereum = (window as any).ethereum;
    if (!ethereum) {
      throw new Error('No wallet extension found. Please install MetaMask.');
    }

    const accounts = (await ethereum.request({
      method: 'eth_requestAccounts'
    })) as string[];

    if (!accounts || accounts.length === 0) {
      throw new Error('No accounts found');
    }

    const provider = new ethers.BrowserProvider(ethereum);
    const network = await provider.getNetwork();

    if (Number(network.chainId) !== ARC_TESTNET_CHAIN_ID) {
      try {
        await ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: `0x${ARC_TESTNET_CHAIN_ID.toString(16)}` }]
        });
      } catch (switchError: any) {
        if (switchError.code === 4902) {
          throw new Error('Arc Testnet not configured. Please add it to MetaMask manually.');
        }
        throw switchError;
      }
    }

    return {
      address: accounts[0],
      provider
    };
  } catch (error: any) {
    throw new Error(error?.message || 'Failed to connect wallet');
  }
}

// ============================================================================
// MAIN PAGE COMPONENT
// ============================================================================

export default function Home() {
  const [activeTab, setActiveTab] = useState<'client' | 'freelancer'>('client');
  const [isWalletConnected, setIsWalletConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [provider, setProvider] = useState<BrowserProvider | null>(null);
  const [contract, setContract] = useState<Contract | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  const handleConnectWallet = async () => {
    setIsConnecting(true);
    setConnectionError(null);

    try {
      const result = await connectWallet();

      if (result) {
        setWalletAddress(result.address);
        setProvider(result.provider);

        const contractInstance = new Contract(
          CONTRACT_ADDRESS,
          CONTRACT_ABI,
          result.provider
        );

        setContract(contractInstance);
        setIsWalletConnected(true);
      }
    } catch (error: any) {
      setConnectionError(error?.message || 'Failed to connect wallet');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = () => {
    setIsWalletConnected(false);
    setWalletAddress(null);
    setProvider(null);
    setContract(null);
    setConnectionError(null);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <Navbar
        isConnected={isWalletConnected}
        walletAddress={walletAddress}
        onConnect={handleConnectWallet}
        onDisconnect={handleDisconnect}
      />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {!isWalletConnected ? (
          <div className="flex flex-col items-center justify-center py-24">
            <div className="text-center">
              <h1 className="mb-4 text-5xl font-bold text-slate-900">ArcMilestone</h1>
              <p className="mb-8 text-lg text-slate-600">
                Secure Escrow Protocol for Web3 Professionals
              </p>
              {connectionError && (
                <div className="mb-6 rounded-lg bg-red-100 p-4 text-red-700">
                  {connectionError}
                </div>
              )}
              <button
                onClick={handleConnectWallet}
                disabled={isConnecting}
                className="rounded-lg bg-blue-600 px-8 py-3 font-semibold text-white transition disabled:bg-slate-400 hover:bg-blue-700"
              >
                {isConnecting ? 'Connecting...' : 'Connect Wallet to Get Started'}
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="mb-8 flex gap-2 border-b border-slate-200">
              <button
                onClick={() => setActiveTab('client')}
                className={`px-6 py-3 font-semibold transition-all ${
                  activeTab === 'client'
                    ? 'border-b-2 border-blue-600 text-blue-600'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Client View
              </button>
              <button
                onClick={() => setActiveTab('freelancer')}
                className={`px-6 py-3 font-semibold transition-all ${
                  activeTab === 'freelancer'
                    ? 'border-b-2 border-blue-600 text-blue-600'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Freelancer View
              </button>
            </div>

            {activeTab === 'client' && (
              <ClientView walletAddress={walletAddress || ''} provider={provider} contract={contract} />
            )}
            {activeTab === 'freelancer' && (
              <FreelancerView walletAddress={walletAddress || ''} provider={provider} contract={contract} />
            )}
          </>
        )}
      </main>
    </div>
  );
}
