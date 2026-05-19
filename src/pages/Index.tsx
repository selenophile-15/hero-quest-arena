import { useNavigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { warmupGameData } from "@/lib/gameData";
import { preloadImages } from "@/lib/imagePreloader";
import { SKILL_NAME_MAP, JOB_NAME_MAP, CHAMPION_NAME_MAP } from "@/lib/nameMap";
import { EQUIP_TYPE_MAP, loadEquipmentByTypes, loadEquipNameMap } from "@/lib/equipmentUtils";
import { Button } from "@/components/ui/button";
import { Monitor } from "lucide-react";
import { useMobileGestures } from "@/hooks/use-mobile-gestures";
import { useDesktopModeState } from "@/hooks/use-desktop-mode";

import landingBg from "@/assets/landing-bg.jpg";
import titleLogo from "@/assets/title-logo.png";
import sponsorFrame from "@/assets/sponsor-frame.png";

const SPONSORS = ["Dogpyo", "거지왕"];

const Index = () => {
  const navigate = useNavigate();
  const { desktopMode, setDesktopMode } = useDesktopModeState();
  const starsRef = useRef<HTMLDivElement>(null);
  const particlesRef = useRef<HTMLDivElement>(null);
  const shootingStarsRef = useRef<HTMLDivElement>(null);
  const [scrollY, setScrollY] = useState(0);

  useMobileGestures(desktopMode);

  // 백그라운드 프리로드: 대시보드 진입 전에 데이터+이미지 모두 준비
  useEffect(() => {
    // 1) JSON 데이터 워밍업
    warmupGameData();

    // 2) 스킬 이미지 전체 프리로드
    const skillImgs: string[] = [];
    for (const [kor, eng] of Object.entries(SKILL_NAME_MAP)) {
      skillImgs.push(`/images/skills/sk_hero/normal/${eng}.webp`);
      skillImgs.push(`/images/skills/sk_hero/rare/${eng}.webp`);
      skillImgs.push(`/images/skills/sk_hero/epic/${eng}.webp`);
    }
    preloadImages(skillImgs);

    // 3) 직업/챔피언 이미지 프리로드
    const heroImgs = Object.values(JOB_NAME_MAP).flatMap((eng) => [
      `/images/classes/${eng}.webp`,
      `/images/classillust/${eng}.webp`,
    ]);
    const champImgs = Object.values(CHAMPION_NAME_MAP).flatMap((eng) => [
      `/images/champion/${eng}.webp`,
      ...[1, 2, 3, 4].map((t) => `/images/skills/sk_champion/${eng}_${t}.webp`),
    ]);
    preloadImages([...heroImgs, ...champImgs]);

    // 4) 장비 이미지 프리로드 (JSON 로드 후 imagePath 사용)
    loadEquipNameMap()
      .then((nameMap) => loadEquipmentByTypes(Object.keys(EQUIP_TYPE_MAP), nameMap))
      .then((items) => preloadImages(items.map((i) => i.imagePath)));
  }, []);

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    // Create twinkling stars
    const starsEl = starsRef.current;
    if (starsEl && starsEl.childElementCount === 0) {
      for (let i = 0; i < 200; i++) {
        const s = document.createElement("div");
        const size = Math.random() * 2 + 0.5;
        const brightness = Math.random() > 0.9 ? 1 : Math.random() * 0.6 + 0.1;
        s.style.cssText = `position:absolute;background:#fff;border-radius:50%;left:${Math.random() * 100}%;top:${Math.random() * 100}%;width:${size}px;height:${size}px;animation:twinkle ${2 + Math.random() * 5}s ease-in-out infinite;animation-delay:${Math.random() * 6}s;opacity:${brightness}`;
        starsEl.appendChild(s);
      }
    }

    // Create rising particles (fire/mana embers)
    const pEl = particlesRef.current;
    if (pEl && pEl.childElementCount === 0) {
      const colors = ["#b39dff", "#8a7dff", "#6b8aff", "#a8c8ff", "#e8e0ff", "#d4d8ff", "#c0b8ff", "#ffffff"];
      for (let i = 0; i < 40; i++) {
        const d = document.createElement("div");
        const size = 1.5 + Math.random() * 3;
        d.style.cssText = `position:absolute;border-radius:50%;left:${Math.random() * 100}%;bottom:0;width:${size}px;height:${size}px;background:${colors[Math.floor(Math.random() * colors.length)]};animation:rise ${8 + Math.random() * 12}s linear infinite;animation-delay:${Math.random() * 8}s;box-shadow:0 0 ${size * 2}px ${colors[Math.floor(Math.random() * colors.length)]}`;
        pEl.appendChild(d);
      }
    }

    // Create shooting stars
    const ssEl = shootingStarsRef.current;
    if (ssEl) {
      const createShootingStar = () => {
        const star = document.createElement("div");
        const startX = Math.random() * 80 + 10;
        const startY = Math.random() * 30;
        const angle = 25 + Math.random() * 20;
        const duration = 1 + Math.random() * 1.5;
        star.style.cssText = `position:absolute;left:${startX}%;top:${startY}%;width:2px;height:2px;background:#fff;border-radius:50%;animation:shootingStar ${duration}s linear forwards;transform:rotate(${angle}deg);box-shadow:0 0 4px #fff, -20px 0 8px rgba(255,255,255,0.5), -40px 0 12px rgba(255,255,255,0.3), -60px 0 16px rgba(255,255,255,0.1)`;
        ssEl.appendChild(star);
        setTimeout(() => star.remove(), duration * 1000 + 100);
      };
      const interval = setInterval(() => createShootingStar(), 2000 + Math.random() * 3000);
      setTimeout(createShootingStar, 500);
      setTimeout(createShootingStar, 1500);
      return () => clearInterval(interval);
    }
  }, []);

  return (
    <div className="min-h-[200vh] bg-background relative overflow-hidden">
      <div className="fixed top-4 right-4 z-20">
        <button
          onClick={() => setDesktopMode((value) => !value)}
          title={desktopMode ? "모바일 모드로 전환" : "데스크탑 모드로 전환"}
          className={`flex items-center justify-center w-8 h-8 rounded-md border border-border/70 backdrop-blur-sm transition-colors ${
            desktopMode ? "bg-primary text-primary-foreground" : "bg-card/80 text-foreground hover:bg-card"
          }`}
        >
          <Monitor className="w-4 h-4" />
        </button>
      </div>

      <style>{`
        @keyframes twinkle {
          0%, 100% { opacity: 0.1; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1.2); }
        }
        @keyframes rise {
          0% { transform: translateY(0) scale(0.3); opacity: 0; }
          10% { opacity: 0.9; }
          80% { opacity: 0.3; }
          100% { transform: translateY(-100vh) scale(1.5); opacity: 0; }
        }
        @keyframes shootingStar {
          0% { opacity: 1; transform: translateX(0) translateY(0); }
          70% { opacity: 1; }
          100% { opacity: 0; transform: translateX(300px) translateY(180px); }
        }
        @keyframes logoFloat {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-8px); }
        }
        @keyframes glowPulse {
          0%, 100% { filter: drop-shadow(0 0 15px rgba(180,200,255,0.4)) drop-shadow(0 0 40px rgba(120,160,255,0.15)) drop-shadow(0 0 60px rgba(200,147,10,0.1)); }
          50% { filter: drop-shadow(0 0 25px rgba(180,200,255,0.7)) drop-shadow(0 0 50px rgba(120,160,255,0.3)) drop-shadow(0 0 80px rgba(200,147,10,0.2)); }
        }
        @keyframes subtitleReveal {
          0% { opacity: 0; letter-spacing: 0.5em; }
          100% { opacity: 1; letter-spacing: 0.2em; }
        }
        @keyframes starSparkle {
          0%, 100% { opacity: 0.3; transform: scale(0.8) rotate(0deg); }
          50% { opacity: 1; transform: scale(1.3) rotate(180deg); }
        }
        @keyframes btnShine {
          0% { left: -100%; }
          100% { left: 200%; }
        }
        @keyframes bulbFlicker {
          0%, 18%, 22%, 25%, 53%, 57%, 100% {
            opacity: 1;
            text-shadow: 0 0 12px rgba(160,130,255,0.45);
          }
          20%, 24%, 55% {
            opacity: 0.25;
            text-shadow: none;
          }
        }
        .bulb-flicker { animation: bulbFlicker 4s linear infinite; }
        .btn-shine { position: relative; overflow: hidden; }
        .btn-shine::after {
          content: '';
          position: absolute;
          top: 0;
          left: -100%;
          width: 50%;
          height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
          animation: btnShine 3s ease-in-out infinite;
        }
      `}</style>

      {/* Background image - single, scrolls with page */}
      <div className="absolute inset-x-0 top-0 z-0 pointer-events-none">
        <div className="relative w-full" style={{ height: "200vh" }}>
          <img
            src={landingBg}
            alt=""
            className="w-full h-full object-cover"
            width={1920}
            height={1280}
            loading="eager"
            decoding="sync"
            {...({ fetchpriority: "high" } as any)}
          />
          {/* Dark overlay on top portion for title readability */}
          <div
            className="absolute top-0 left-0 right-0 h-[50%]"
            style={{
              background: "linear-gradient(180deg, rgba(5,8,20,0.85) 0%, rgba(10,15,30,0.6) 40%, transparent 100%)",
            }}
          />
          {/* Bottom fade */}
          <div
            className="absolute bottom-0 left-0 right-0 h-[20%]"
            style={{
              background: "linear-gradient(0deg, rgba(10,10,15,0.95) 0%, transparent 100%)",
            }}
          />
        </div>
      </div>

      {/* Stars overlay */}
      <div
        ref={starsRef}
        className="fixed inset-0 z-[1] pointer-events-none"
        style={{
          opacity: Math.max(0, 1 - scrollY / 1200),
        }}
      />

      {/* Shooting stars */}
      <div ref={shootingStarsRef} className="fixed inset-0 z-[1] pointer-events-none" />

      {/* Rising particles (embers) */}
      <div
        ref={particlesRef}
        className="absolute inset-x-0 z-[3] pointer-events-none"
        style={{ top: "60vh", height: "140vh" }}
      />

      {/* ===== HERO SECTION ===== */}
      <div className="relative z-10 min-h-screen flex items-center justify-center">
        <div
          className="text-center px-4 py-20"
          style={{
            opacity: Math.max(0, 1 - scrollY / 600),
          }}
        >
          <div className="mb-6 relative" style={{ animation: "logoFloat 6s ease-in-out infinite" }}>
            {/* Decorative star sparkles around title */}
            <div
              className="absolute -top-6 -left-12 text-blue-200 text-lg"
              style={{ animation: "starSparkle 3s ease-in-out infinite" }}
            >
              ✦
            </div>
            <div
              className="absolute -top-4 -right-10 text-purple-200 text-sm"
              style={{ animation: "starSparkle 4s ease-in-out infinite 1s" }}
            >
              ✧
            </div>
            <div
              className="absolute -bottom-4 -left-8 text-purple-300/60 text-sm"
              style={{ animation: "starSparkle 3.5s ease-in-out infinite 0.5s" }}
            >
              ✦
            </div>
            <div
              className="absolute -bottom-6 -right-14 text-blue-300/50 text-base"
              style={{ animation: "starSparkle 5s ease-in-out infinite 2s" }}
            >
              ✧
            </div>

            <span
              className="font-display text-[13px] tracking-[0.2em] uppercase block mb-4 bulb-flicker"
              style={{
                color: "hsl(260 40% 65%)",
              }}
            >
              ⚔ 셀레노필 제작 ⚔
            </span>

            {/* Game logo image */}
            <img
              src={titleLogo}
              alt="샵타이탄 퀘스트 시뮬레이터"
              className="mx-auto select-none"
              width={1584}
              height={672}
              style={{
                maxWidth: "min(520px, 85vw)",
                height: "auto",
                filter: "drop-shadow(0 0 20px rgba(140,100,255,0.3)) drop-shadow(0 0 40px rgba(140,100,255,0.15))",
                animation: "glowPulse 4s ease-in-out infinite",
              }}
            />

            {/* Subtitle tagline */}
            <p
              className="mt-3 text-[14px] tracking-[0.15em]"
              style={{
                color: "hsl(260 30% 60%)",
                textShadow: "0 0 8px rgba(160,130,255,0.2)",
              }}
            >
              ─── SHOP TITANS QUEST SIMULATOR ───
            </p>
          </div>

          <div className="mb-8" />

          <Button
            size="lg"
            onClick={() => navigate("/dashboard")}
            className="btn-shine text-base px-14 py-7 font-display tracking-wider relative group
              transition-all duration-300 ease-out
              hover:scale-105 hover:shadow-[0_0_36px_rgba(180,150,255,0.5),0_0_72px_rgba(140,100,255,0.25)]
              active:scale-95"
            style={{
              background: "linear-gradient(135deg, #1a1438 0%, #2a1f5c 50%, #3a2870 100%)",
              boxShadow:
                "0 0 24px rgba(180,150,255,0.25), 0 6px 24px rgba(0,0,0,0.5), inset 0 1px 0 rgba(220,200,255,0.3), inset 0 -1px 0 rgba(120,80,200,0.4)",
              border: "1px solid rgba(200,170,255,0.35)",
            }}
          >
            <span
              style={{
                fontFamily: "'Noto Sans KR', sans-serif",
                fontWeight: 700,
                letterSpacing: "0.32em",
                paddingLeft: "0.32em",
                fontSize: "1.1rem",
                background: "linear-gradient(180deg, #f3e8ff 0%, #c8b3ff 55%, #a98cff 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                textShadow: "0 0 12px rgba(200,170,255,0.4)",
                filter: "drop-shadow(0 0 6px rgba(180,150,255,0.5))",
              }}
            >
              모험 시작
            </span>
          </Button>

          <div className="mt-20 animate-bounce opacity-40">
            <div className="w-6 h-10 rounded-full border-2 border-foreground/30 mx-auto flex justify-center pt-2">
              <div className="w-1 h-3 bg-foreground/40 rounded-full" />
            </div>
          </div>
        </div>
      </div>

      {/* ===== SPONSOR LIST SECTION ===== */}
      <div className="relative z-10 max-w-3xl mx-auto px-6 pb-32" style={{ marginTop: "-2rem" }}>
        <div
          className="relative mx-auto select-none"
          style={{
            width: "100%",
            aspectRatio: "1536 / 1024",
            backgroundImage: `url(${sponsorFrame})`,
            backgroundSize: "100% 100%",
            backgroundRepeat: "no-repeat",
            filter: "drop-shadow(0 0 30px rgba(140,100,255,0.25)) drop-shadow(0 8px 24px rgba(0,0,0,0.5))",
          }}
        >
          {/* Title overlay: replace "후원자 명단" with "후원자" - aligned with the leaf flourishes */}
          <div
            className="absolute left-1/2 -translate-x-1/2 flex items-center justify-center"
            style={{
              top: "21%",
              width: "38%",
              height: "8%",
            }}
          >
            <span
              className="font-display"
              style={{
                fontSize: "1.15rem",
                letterSpacing: "0.32em",
                fontWeight: 600,
                paddingLeft: "0.32em",
                background: "linear-gradient(180deg, #f3e8ff 0%, #c8b3ff 60%, #a98cff 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                textShadow: "0 0 12px rgba(180,150,255,0.35)",
                filter: "drop-shadow(0 0 6px rgba(200,170,255,0.4))",
              }}
            >
              후원자
            </span>
          </div>

          {/* Sponsor names area - fills from top, max 3 per row, fixed slot spacing */}
          <div
            className="absolute inset-x-0 flex flex-col items-start"
            style={{
              top: "36%",
              bottom: "20%",
              paddingLeft: "14%",
              paddingRight: "14%",
              gap: "0.9rem",
            }}
          >
            {Array.from({ length: Math.ceil(SPONSORS.length / 3) }).map((_, rowIdx) => {
              const rowNames = SPONSORS.slice(rowIdx * 3, rowIdx * 3 + 3);
              return (
                <div
                  key={rowIdx}
                  className="w-full grid"
                  style={{
                    gridTemplateColumns: `repeat(${rowNames.length}, minmax(0, 1fr))`,
                    columnGap: "1rem",
                    justifyItems: "center",
                  }}
                >
                  {rowNames.map((name) => (
                    <div
                      key={name}
                      className="font-display"
                      style={{
                        fontSize: "1.05rem",
                        letterSpacing: "0.18em",
                        fontWeight: 600,
                        background: "linear-gradient(180deg, #f3e8ff 0%, #c8b3ff 45%, #ffd97a 100%)",
                        WebkitBackgroundClip: "text",
                        WebkitTextFillColor: "transparent",
                        textShadow: "0 0 14px rgba(200,170,255,0.55), 0 0 28px rgba(160,130,255,0.35)",
                        filter: "drop-shadow(0 0 8px rgba(200,170,255,0.5))",
                      }}
                    >
                      {name}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
