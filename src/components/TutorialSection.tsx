export function TutorialSection(): JSX.Element {
  const steps: string[] = [
    "「つくる」タブで画像をアップロードする（貼り付け・カメラも使えます）",
    "「変換する！」を押して線画とカラーパレットを作る",
    "キャンバスでパレットから色・太さ・ツールを選んで色をぬる",
    "「完成！」を押すとPNG保存され、そのままタイムラインに投稿できる",
    "「みんなの作品」タブで投稿を見て、いいね❤️やコメント💬を送る",
    "「マイページ」タブでニックネームとアイコンを設定・変更する",
  ];

  return (
    <section className="panel-section tutorial-section" aria-labelledby="tutorial-heading">
      <div className="section-heading">
        <h2 id="tutorial-heading">使い方</h2>
        <span className="section-note">アップロードから投稿まで</span>
      </div>
      <ol className="tutorial-list">
        {steps.map((step: string) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
      <p className="helper-text top-spaced">
        タイムラインは同じサーバーにつながっている人と共有されます。同じWi-Fiの友だちと一緒に使ってみよう。
      </p>
    </section>
  );
}
