/** The app's name and mark. Change APP_NAME (and index.html / manifest.webmanifest) to rename the app. */
export const APP_NAME = 'המשקלים שלי';

function Mark({ size }: { size: number }) {
  return <img src="/icon-192.png" alt="" width={size} height={size} style={{ borderRadius: size / 4.5, display: 'block' }} />;
}

export function BrandBar() {
  return (
    <div className="brandbar">
      <span className="lockup-row">
        <Mark size={28} />
        <b>{APP_NAME}</b>
      </span>
    </div>
  );
}

export function LogoLarge() {
  return (
    <span className="lockup lg">
      <Mark size={72} />
      <b className="app-name-lg">{APP_NAME}</b>
    </span>
  );
}
