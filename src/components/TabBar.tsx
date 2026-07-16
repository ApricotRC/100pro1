export type TabId = "create" | "timeline" | "mypage" | "help";

interface TabDefinition {
  id: TabId;
  label: string;
  icon: string;
}

const TABS: TabDefinition[] = [
  { id: "create", label: "つくる", icon: "🖌️" },
  { id: "timeline", label: "みんなの作品", icon: "🌏" },
  { id: "mypage", label: "マイページ", icon: "👤" },
  { id: "help", label: "使い方", icon: "❓" },
];

interface TabBarProps {
  activeTab: TabId;
  onSelect: (tab: TabId) => void;
}

export function TabBar({ activeTab, onSelect }: TabBarProps): JSX.Element {
  return (
    <nav className="tab-bar" role="tablist" aria-label="メインメニュー">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={activeTab === tab.id}
          className={activeTab === tab.id ? "tab-button is-active" : "tab-button"}
          onClick={() => onSelect(tab.id)}
        >
          <span className="tab-icon" aria-hidden="true">
            {tab.icon}
          </span>
          <span className="tab-label">{tab.label}</span>
        </button>
      ))}
    </nav>
  );
}
