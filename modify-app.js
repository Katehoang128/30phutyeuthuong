import fs from 'fs';

const filePath = 'artifacts/30-phut-yeu-thuong/src/App.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add drawer and globalPhone states to Shell
content = content.replace(
  'const [upgradeOpen, setUpgradeOpen] = useState(false);',
  `const [upgradeOpen, setUpgradeOpen] = useState(false);\n  const [drawerOpen, setDrawerOpen] = useState(false);\n  const [globalPhone, setGlobalPhone] = useState(() => window.localStorage.getItem('30phut-user-phone') || '');`
);

// 2. Add MobileDrawer rendering to Shell
content = content.replace(
  '<ProUpgradeModal open={upgradeOpen}',
  '<MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} isPro={isPro} phone={globalPhone} onUpgrade={() => { setDrawerOpen(false); openUpgrade(\'drawer\'); }} onOpenSettings={() => { if (location !== \'/\') { window.location.href = \'/\'; } setSettingsOpen(true); }} />\n<ProUpgradeModal globalPhone={globalPhone} setGlobalPhone={setGlobalPhone} open={upgradeOpen}'
);

// 3. Update top actions in Shell to include Hamburger
content = content.replace(
  '<button onClick={() => window.print()} className="tactile flex h-10 w-10 items-center justify-center rounded-full border bg-card text-muted-foreground" aria-label="In trang" data-testid="button-print"><Printer size={17} /></button>',
  `<button onClick={() => window.print()} className="tactile hidden md:flex h-10 w-10 items-center justify-center rounded-full border bg-card text-muted-foreground" aria-label="In trang" data-testid="button-print"><Printer size={17} /></button>\n<button onClick={() => setDrawerOpen(true)} className="tactile flex h-10 w-10 items-center justify-center rounded-full border bg-card text-foreground" data-testid="button-open-drawer" aria-label="Mở menu"><Menu size={19} /></button>`
);

// We need to hide the top "Nâng cấp Pro" button on mobile since it's in the drawer
content = content.replace(
  '{isPro ? <span className="inline-flex items-center gap-1.5 rounded-full bg-accent px-3 py-1.5 text-xs font-bold text-accent-foreground"><Crown size={13} /> Thành viên Pro</span> : <button onClick={() => openUpgrade(\'header\')} className="tactile inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-2 text-xs font-bold text-primary-foreground" data-testid="button-header-upgrade"><Crown size={13} /> Nâng cấp Pro</button>}',
  '{isPro ? <span className="hidden md:inline-flex items-center gap-1.5 rounded-full bg-accent px-3 py-1.5 text-xs font-bold text-accent-foreground"><Crown size={13} /> Thành viên Pro</span> : <button onClick={() => openUpgrade(\'header\')} className="tactile hidden md:inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-2 text-xs font-bold text-primary-foreground" data-testid="button-header-upgrade"><Crown size={13} /> Nâng cấp Pro</button>}'
);

// 4. Update ProUpgradeModal signature
content = content.replace(
  'function ProUpgradeModal({ open, onClose, onUnlocked }: { open: boolean; onClose: () => void; onUnlocked: () => void }) {',
  'function ProUpgradeModal({ open, onClose, onUnlocked, globalPhone, setGlobalPhone }: { open: boolean; onClose: () => void; onUnlocked: () => void; globalPhone?: string; setGlobalPhone?: (p: string) => void }) {'
);

// 5. Update phone initialization in ProUpgradeModal
content = content.replace(
  'const [phone, setPhone] = useState(\'\');',
  'const [phone, setPhone] = useState(globalPhone || \'\');\n\n  useEffect(() => {\n    if (phone && setGlobalPhone) {\n      setGlobalPhone(phone);\n      window.localStorage.setItem(\'30phut-user-phone\', phone);\n    }\n  }, [phone, setGlobalPhone]);\n\n  useEffect(() => {\n    if (open && globalPhone && !phone) {\n      setPhone(globalPhone);\n    }\n  }, [open, globalPhone]);'
);

// 6. Fix BottomNav
content = content.replace(
  "const items = [{ href: '/', label: 'Thực đơn', icon: ChefHat }, { href: '/shopping', label: 'Đi chợ', icon: ShoppingBasket }, { href: '/costs', label: 'Chi phí', icon: WalletCards }, { href: '/ask-ai', label: 'Hỏi AI', icon: Sparkles }];",
  "const items = [{ href: '/', label: 'Thực đơn', icon: Utensils }, { href: '/shopping', label: 'Đi chợ', icon: ShoppingBasket }, { href: '/costs', label: 'Tài Chính', icon: WalletCards }, { href: '/ask-ai', label: 'Bếp AI', icon: Sparkles }];"
);
content = content.replace(
  "className={`flex flex-col items-center gap-1 rounded-xl px-2 py-2 text-[10px] font-bold transition-colors ${active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}",
  "className={`flex flex-col items-center gap-1 rounded-xl px-1.5 py-2 text-[10px] font-bold transition-all ${active ? 'bg-primary/10 text-primary scale-105' : 'text-muted-foreground hover:bg-muted'}`}"
);

// 7. Add lucide imports
content = content.replace(
  "} from 'lucide-react';",
  ", Menu, User, Settings, ArrowRight } from 'lucide-react';"
);

// 8. Insert MobileDrawer Component at the end
const mobileDrawerCode = `
function MobileDrawer({ open, onClose, isPro, phone, onUpgrade, onOpenSettings }: { open: boolean, onClose: () => void, isPro: boolean, phone: string, onUpgrade: () => void, onOpenSettings: () => void }) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
      const handleEscape = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
      document.addEventListener('keydown', handleEscape);
      return () => {
        document.body.style.overflow = '';
        document.removeEventListener('keydown', handleEscape);
      };
    }
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="Menu ứng dụng">
      <div className="absolute inset-0 bg-foreground/40 backdrop-blur-sm transition-opacity animate-in fade-in duration-300" onClick={onClose} aria-hidden="true" data-testid="drawer-backdrop" />
      <div className="relative flex w-full max-w-[280px] flex-col bg-card shadow-2xl animate-in slide-in-from-right duration-300">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <span className="display-font text-lg font-bold text-primary">Tài khoản</span>
          <button onClick={onClose} className="rounded-full p-2 text-muted-foreground hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-primary" aria-label="Đóng menu" data-testid="button-close-drawer">
            <X size={20} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-5">
          <div className="mb-6 flex items-center gap-3 rounded-2xl bg-secondary/30 p-4 border border-secondary">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <User size={22} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-foreground">
                {phone ? phone : 'Chưa cập nhật SĐT'}
              </p>
              <div className="mt-1">
                {isPro ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-accent-foreground">
                    <Crown size={12} /> VIP Pro
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Gói miễn phí
                  </span>
                )}
              </div>
            </div>
          </div>
          
          <div className="space-y-2">
            <button onClick={() => { onClose(); onOpenSettings(); }} className="flex min-h-[44px] w-full items-center justify-between rounded-xl p-3 hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-primary" data-testid="button-drawer-settings">
              <span className="flex items-center gap-3 text-sm font-bold text-foreground"><Settings size={18} className="text-muted-foreground" /> Khẩu vị & Dị ứng</span>
              <ArrowRight size={16} className="text-muted-foreground" />
            </button>
            
            {!isPro && (
              <button onClick={() => { onClose(); onUpgrade(); }} className="flex min-h-[44px] w-full items-center justify-between rounded-xl bg-[linear-gradient(135deg,hsl(13_80%_56%/.1),hsl(43_100%_61%/.15))] p-3 text-primary hover:bg-[linear-gradient(135deg,hsl(13_80%_56%/.15),hsl(43_100%_61%/.2))] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary" data-testid="button-drawer-upgrade">
                <span className="flex items-center gap-3 text-sm font-bold"><Crown size={18} /> Nâng cấp Pro 49k</span>
                <ArrowRight size={16} />
              </button>
            )}
            
            <a href="https://zalo.me" target="_blank" rel="noopener noreferrer" className="flex min-h-[44px] w-full items-center justify-between rounded-xl p-3 hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-primary" data-testid="link-drawer-zalo">
              <span className="flex items-center gap-3 text-sm font-bold text-foreground"><MessageCircle size={18} className="text-blue-500" /> Nhóm Zalo VIP</span>
              <ExternalLink size={16} className="text-muted-foreground" />
            </a>
            
            <a href="https://35to53.com" target="_blank" rel="noopener noreferrer" className="flex min-h-[44px] w-full items-center justify-between rounded-xl p-3 hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-primary" data-testid="link-drawer-blog">
              <span className="flex items-center gap-3 text-sm font-bold text-foreground"><BookOpen size={18} className="text-muted-foreground" /> Blog 35to53.com</span>
              <ExternalLink size={16} className="text-muted-foreground" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
`;

content += '\n' + mobileDrawerCode;

fs.writeFileSync(filePath, content, 'utf8');
