
import { Download, Smartphone, ShieldCheck } from "lucide-react";

export default function AppDownloadBanner() {
  return (
    <section
      className="app-download-banner"
      aria-labelledby="app-download-title"
    >
      <div className="app-download-banner__icon">
        <img
          src="/railpulse-app-icon.png"
          alt="RailPulse app icon"
          width="64"
          height="64"
        />
      </div>

      <div className="app-download-banner__content">
        <div className="app-download-banner__eyebrow">
          <Smartphone size={15} aria-hidden="true" />
          RAILPULSE FOR ANDROID
        </div>

        <h2 id="app-download-title">Take RailPulse with you</h2>

        <p>
          Explore trains on your phone. Download the Android app
          and install it directly, without the Play Store.
        </p>

        <span className="app-download-banner__note">
          <ShieldCheck size={15} aria-hidden="true" />
          Free APK download
        </span>
      </div>

      <a
        className="app-download-banner__button"
        href="https://github.com/RMahato4444/RailPulse/releases/latest/download/RailPulse-Android.apk"
        aria-label="Download the RailPulse Android APK"
      >
        <Download size={19} aria-hidden="true" />
        Download APK
      </a>
    </section>
  );
}
