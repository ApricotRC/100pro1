export function TutorialSection(): JSX.Element {
  const steps: string[] = [
    "画像をアップロードしてサムネイルとプレビューを確認する",
    "変換する！を押して線画と変換画像を作成する",
    "キャンバスをひらいてパレットから色・太さ・ツールを選ぶ",
    "完成！からPNG保存し、ギャラリーで仕上がりを確認する",
  ];

  return (
    <section className="panel-section tutorial-section" aria-labelledby="tutorial-heading">
      <div className="section-heading">
        <h2 id="tutorial-heading">チュートリアル</h2>
        <span className="section-note">アップロードから完成まで</span>
      </div>
      <ol className="tutorial-list">
        {steps.map((step: string) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
      <div className="video-placeholder" aria-label="チュートリアル動画プレースホルダー">
        <span>16:9 Tutorial Preview</span>
      </div>
    </section>
  );
}
