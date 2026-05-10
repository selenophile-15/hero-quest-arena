import { useNavigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Monitor, Swords } from "lucide-react";
import { useMobileGestures } from "@/hooks/use-mobile-gestures";
import { useDesktopModeState } from "@/hooks/use-desktop-mode";

import landingBg from "@/assets/landing-bg.jpg";
import titleLogo from "@/assets/title-logo.png";

const Index = () => {
  const navigate = useNavigate();
  const { desktopMode, setDesktopMode } = useDesktopModeState();
  const starsRef = useRef<HTMLDivElement>(null);
  const particlesRef = useRef<HTMLDivElement>(null);
  const shootingStarsRef = useRef<HTMLDivElement>(null);
  const [scrollY, setScrollY] = useState(0);
  

  useMobileGestures(desktopMode);

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    // Create twinkling stars
    const starsEl = starsRef.current;
    if (starsEl && starsEl.childElementCount === 0) {
      for (let i = 0; i < 200; i++) {
        const s = document.createElement('div');
        const size = Math.random() * 2 + 0.5;
        const brightness = Math.random() > 0.9 ? 1 : Math.random() * 0.6 + 0.1;
        s.style.cssText = `position:absolute;background:#fff;border-radius:50%;left:${Math.random()*100}%;top:${Math.random()*100}%;width:${size}px;height:${size}px;animation:twinkle ${2+Math.random()*5}s ease-in-out infinite;animation-delay:${Math.random()*6}s;opacity:${brightness}`;
        starsEl.appendChild(s);
      }
    }

    // Create rising particles (fire/mana embers)
    const pEl = particlesRef.current;
    if (pEl && pEl.childElementCount === 0) {
      const colors = ['#c8930a','#e8b830','#d4a020','#f0d060','#a06818','#ff6b35','#ff8c42'];
      for (let i = 0; i < 40; i++) {
        const d = document.createElement('div');
        const size = 1.5 + Math.random() * 3;
        d.style.cssText = `position:absolute;border-radius:50%;left:${Math.random()*100}%;bottom:0;width:${size}px;height:${size}px;background:${colors[Math.floor(Math.random()*colors.length)]};animation:rise ${8+Math.random()*12}s linear infinite;animation-delay:${Math.random()*8}s;box-shadow:0 0 ${size*2}px ${colors[Math.floor(Math.random()*colors.length)]}`;
        pEl.appendChild(d);
      }
    }

    // Create shooting stars
    const ssEl = shootingStarsRef.current;
    if (ssEl) {
      const createShootingStar = () => {
        const star = document.createElement('div');
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

  const sponsors = ['Dogpyo', '거지왕'];

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <div className="fixed top-4 right-4 z-20">
        <button
          onClick={() => setDesktopMode((value) => !value)}
          title={desktopMode ? '모바일 모드로 전환' : '데스크탑 모드로 전환'}
          className={`flex items-center justify-center w-9 h-9 rounded-md border border-border/70 backdrop-blur-sm transition-colors ${
            desktopMode ? 'bg-primary text-primary-foreground' : 'bg-card/80 text-foreground hover:bg-card'
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
        @keyframes starSparkle {
          0%, 100% { opacity: 0.3; transform: scale(0.8) rotate(0deg); }
          50% { opacity: 1; transform: scale(1.3) rotate(180deg); }
        }
        @keyframes bulbFlicker {
          0%, 6%   { opacity: 0.15; text-shadow: none; }
          7%       { opacity: 1; }
          8%, 10%  { opacity: 0.2; }
          11%      { opacity: 1; }
          12%, 13% { opacity: 0.15; }
          14%      { opacity: 1; }
          15%, 70% { opacity: 1; }
          71%, 72% { opacity: 0.25; }
          73%      { opacity: 1; }
          74%, 75% { opacity: 0.2; }
          76%, 100%{ opacity: 1; }
        }
        @keyframes btnShine {
          0% { left: -100%; }
          100% { left: 200%; }
        }
        .btn-shine { position: relative; overflow: hidden; }
        .btn-shine::after {
          content: '';
          position: absolute;
          top: 0;
          left: -100%;
          width: 50%;
          height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.25), transparent);
          animation: btnShine 3.5s ease-in-out infinite;
        }
        @keyframes royalShimmer {
          0%, 100% { background-position: 0% 50%; }
          50%      { background-position: 100% 50%; }
        }
      `}</style>

      {/* Background image */}
      <div className="absolute inset-x-0 top-0 z-0 pointer-events-none">
        <div className="relative w-full" style={{ aspectRatio: '1920 / 1280' }}>
          <img
            src={landingBg}
            alt=""
            className="w-full h-full object-contain object-top"
            width={1920}
            height={1280}
            fetchPriority="high"
            decoding="async"
          />
          <div className="absolute top-0 left-0 right-0 h-[50%]" style={{
            background: 'linear-gradient(180deg, rgba(5,8,20,0.85) 0%, rgba(10,15,30,0.6) 40%, transparent 100%)'
          }} />
          <div className="absolute bottom-0 left-0 right-0 h-[25%]" style={{
            background: 'linear-gradient(0deg, rgba(10,10,15,0.95) 0%, transparent 100%)'
          }} />
        </div>
      </div>

      {/* Stars overlay */}
      <div ref={starsRef} className="fixed inset-0 z-[1] pointer-events-none" style={{
        opacity: Math.max(0, 1 - scrollY / 1200),
      }} />
      <div ref={shootingStarsRef} className="fixed inset-0 z-[1] pointer-events-none" />
      <div ref={particlesRef} className="absolute inset-x-0 z-[3] pointer-events-none" style={{ top: '60vh', height: '140vh' }} />

      {/* ===== HERO SECTION ===== */}
      <div className="relative z-10 min-h-screen flex items-center justify-center">
        <div className="text-center px-4 py-16" style={{
          opacity: Math.max(0, 1 - scrollY / 600),
        }}>
          <div className="mb-6 relative" style={{ animation: 'logoFloat 6s ease-in-out infinite' }}>
            <div className="absolute -top-6 -left-12 text-blue-200 text-lg" style={{ animation: 'starSparkle 3s ease-in-out infinite' }}>✦</div>
            <div className="absolute -top-4 -right-10 text-purple-200 text-sm" style={{ animation: 'starSparkle 4s ease-in-out infinite 1s' }}>✧</div>
            <div className="absolute -bottom-4 -left-8 text-purple-300/60 text-sm" style={{ animation: 'starSparkle 3.5s ease-in-out infinite 0.5s' }}>✦</div>
            <div className="absolute -bottom-6 -right-14 text-blue-300/50 text-base" style={{ animation: 'starSparkle 5s ease-in-out infinite 2s' }}>✧</div>

            <span className="font-display text-[13px] tracking-[0.2em] uppercase block mb-4" style={{
              color: 'hsl(260 40% 70%)',
              animation: 'bulbFlicker 5s ease-in-out infinite',
              textShadow: '0 0 12px rgba(160,130,255,0.5), 0 0 24px rgba(160,130,255,0.25)',
            }}>
              ⚔ 셀레노필 제작 ⚔
            </span>

            {/* Title logo with reserved space (1584:672 ≈ 2.357) */}
            <div
              className="mx-auto"
              style={{
                width: 'min(760px, 92vw)',
                aspectRatio: '1584 / 672',
              }}
            >
              <img
                src={titleLogo}
                alt="샵타이탄 퀘스트 시뮬레이터"
                className="w-full h-full select-none"
                width={1584}
                height={672}
                fetchPriority="high"
                decoding="async"
                style={{
                  filter: 'drop-shadow(0 0 20px rgba(140,100,255,0.3)) drop-shadow(0 0 40px rgba(140,100,255,0.15))',
                  animation: 'glowPulse 4s ease-in-out infinite',
                }}
              />
            </div>

            <p className="mt-3 text-[12px] tracking-[0.15em]" style={{
              color: 'hsl(260 30% 60%)',
              textShadow: '0 0 8px rgba(160,130,255,0.2)',
            }}>
              ─── SHOP TITANS QUEST SIMULATOR ───
            </p>
          </div>

          <div className="mt-2 mb-10" />

          <Button
            size="lg"
            onClick={() => navigate("/dashboard")}
            className="btn-shine px-14 py-7 font-display tracking-wider relative group
              transition-all duration-300 ease-out
              hover:scale-105 hover:shadow-[0_0_36px_rgba(180,160,255,0.45),0_0_70px_rgba(200,147,10,0.18)]
              active:scale-95"
            style={{
              background: 'linear-gradient(135deg, hsl(235 45% 22%) 0%, hsl(255 35% 28%) 50%, hsl(225 45% 20%) 100%)',
              boxShadow: '0 0 24px rgba(160,170,255,0.18), 0 6px 26px rgba(0,0,0,0.5), inset 0 1px 0 rgba(220,225,255,0.32), inset 0 0 0 1px rgba(190,180,255,0.35), inset 0 -1px 0 rgba(0,0,0,0.4)',
              border: '1px solid rgba(200,205,255,0.45)',
              borderRadius: '10px',
            }}
          >
            <Swords className="w-5 h-5 mr-2 transition-transform duration-300 group-hover:rotate-12" style={{ color: '#dbe4ff' }} />
            <span style={{
              fontFamily: "'Noto Sans KR', sans-serif",
              fontWeight: 700,
              letterSpacing: '0.2em',
              fontSize: '1.15rem',
              background: 'linear-gradient(180deg, #f3f6ff 0%, #d8c8ff 50%, #ffd97a 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}>로그인</span>
          </Button>

          <div className="mt-16 animate-bounce opacity-40">
            <div className="w-6 h-10 rounded-full border-2 border-foreground/30 mx-auto flex justify-center pt-2">
              <div className="w-1 h-3 bg-foreground/40 rounded-full" />
            </div>
          </div>
        </div>
      </div>

      {/* ===== SPONSORS SECTION ===== */}
      <div className="relative z-10 max-w-2xl mx-auto px-6 pb-32" style={{ marginTop: '-2rem' }}>
        {/* Outer shimmer frame */}
        <div
          className="relative rounded-[28px] p-[3px] overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, #dbe1ff 0%, #a8b4e8 18%, #7d8acc 32%, #b6a5e0 50%, #e0d2f0 65%, #8e9bd6 80%, #c9d1f5 100%)',
            backgroundSize: '300% 300%',
            animation: 'royalShimmer 9s ease-in-out infinite',
            boxShadow: '0 12px 50px rgba(120,110,200,0.4), 0 0 32px rgba(180,170,240,0.3), inset 0 0 0 1px rgba(255,255,255,0.18)',
          }}
        >
          {/* Inner thin gold-violet line */}
          <div
            className="rounded-[26px] p-[1px]"
            style={{
              background: 'linear-gradient(135deg, rgba(255,230,170,0.55), rgba(190,170,255,0.55), rgba(255,230,170,0.55))',
            }}
          >
            <div
              className="rounded-[25px] px-12 py-14 relative"
              style={{
                background: 'radial-gradient(ellipse at top, rgba(40,32,68,0.97) 0%, rgba(18,18,32,0.98) 60%, rgba(14,14,26,0.98) 100%)',
                boxShadow: 'inset 0 1px 0 rgba(220,220,255,0.10), inset 0 -1px 0 rgba(0,0,0,0.5), inset 0 0 60px rgba(140,120,220,0.08)',
              }}
            >
              {/* Ornate corner flourishes */}
              <div className="absolute top-2 left-3 text-2xl leading-none" style={{ color: 'hsl(250 50% 80%)', textShadow: '0 0 10px rgba(200,180,255,0.7)' }}>❦</div>
              <div className="absolute top-2 right-3 text-2xl leading-none" style={{ color: 'hsl(250 50% 80%)', textShadow: '0 0 10px rgba(200,180,255,0.7)', transform: 'scaleX(-1)' }}>❦</div>
              <div className="absolute bottom-2 left-3 text-2xl leading-none" style={{ color: 'hsl(250 50% 80%)', textShadow: '0 0 10px rgba(200,180,255,0.7)', transform: 'scaleY(-1)' }}>❦</div>
              <div className="absolute bottom-2 right-3 text-2xl leading-none" style={{ color: 'hsl(250 50% 80%)', textShadow: '0 0 10px rgba(200,180,255,0.7)', transform: 'scale(-1,-1)' }}>❦</div>

              {/* Top medallion ribbon */}
              <div className="flex items-center justify-center gap-3 mb-6">
                <span className="text-base" style={{ color: 'hsl(45 70% 75%)', textShadow: '0 0 10px rgba(255,220,160,0.6)' }}>━━━━</span>
                <span className="text-xl" style={{ color: 'hsl(45 80% 78%)', textShadow: '0 0 14px rgba(255,220,160,0.85)' }}>♕</span>
                <span
                  className="font-display tracking-[0.45em] text-[12px] uppercase"
                  style={{
                    background: 'linear-gradient(135deg, #f5e6b8 0%, #e8d2ff 50%, #f5e6b8 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                  }}
                >
                  Hall of Patrons
                </span>
                <span className="text-xl" style={{ color: 'hsl(45 80% 78%)', textShadow: '0 0 14px rgba(255,220,160,0.85)' }}>♕</span>
                <span className="text-base" style={{ color: 'hsl(45 70% 75%)', textShadow: '0 0 10px rgba(255,220,160,0.6)' }}>━━━━</span>
              </div>

              {/* Decorative divider */}
              <div className="flex items-center justify-center gap-2 mb-6">
                <span className="h-[1px] w-16" style={{ background: 'linear-gradient(90deg, transparent, rgba(200,180,255,0.6), transparent)' }} />
                <span className="text-sm" style={{ color: 'hsl(250 40% 78%)' }}>✦</span>
                <span className="text-xs" style={{ color: 'hsl(45 70% 78%)' }}>❖</span>
                <span className="text-sm" style={{ color: 'hsl(250 40% 78%)' }}>✦</span>
                <span className="h-[1px] w-16" style={{ background: 'linear-gradient(90deg, transparent, rgba(200,180,255,0.6), transparent)' }} />
              </div>

              <ul className="space-y-4 text-center">
                {sponsors.map((name) => (
                  <li
                    key={name}
                    style={{
                      fontFamily: "'Cormorant Garamond', serif",
                      fontWeight: 600,
                      fontStyle: 'italic',
                      fontSize: '1.55rem',
                      letterSpacing: '0.08em',
                      background: 'linear-gradient(180deg, #fff8e0 0%, #e6d4ff 50%, #f8e4b8 100%)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      textShadow: '0 0 20px rgba(220,200,255,0.35)',
                    }}
                  >
                    <span style={{ color: 'hsl(45 70% 70%)', WebkitTextFillColor: 'hsl(45 70% 72%)', marginRight: '0.6em', fontSize: '0.85em' }}>❈</span>
                    {name}
                    <span style={{ color: 'hsl(45 70% 70%)', WebkitTextFillColor: 'hsl(45 70% 72%)', marginLeft: '0.6em', fontSize: '0.85em' }}>❈</span>
                  </li>
                ))}
              </ul>

              {/* Bottom divider */}
              <div className="flex items-center justify-center gap-2 mt-7">
                <span className="h-[1px] w-20" style={{ background: 'linear-gradient(90deg, transparent, rgba(200,180,255,0.5), transparent)' }} />
                <span className="text-sm" style={{ color: 'hsl(45 70% 78%)' }}>❖</span>
                <span className="h-[1px] w-20" style={{ background: 'linear-gradient(90deg, transparent, rgba(200,180,255,0.5), transparent)' }} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
