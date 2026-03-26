import { useNavigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Swords, Shield, Trophy } from "lucide-react";
import selenofilLogo from "@/assets/selenofil-logo.png";
import landingBg from "@/assets/landing-bg.png";
import featureList from "@/assets/feature-list.jpg";
import featureQuest from "@/assets/feature-quest.jpg";
import featureRanking from "@/assets/feature-ranking.jpg";

const Index = () => {
  const navigate = useNavigate();
  const starsRef = useRef<HTMLDivElement>(null);
  const particlesRef = useRef<HTMLDivElement>(null);
  const shootingStarsRef = useRef<HTMLDivElement>(null);
  const [scrollY, setScrollY] = useState(0);
  const [hoveredFeature, setHoveredFeature] = useState<number | null>(null);

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

  const features = [
    { num: '01', title: "리스트 관리", desc: "영웅과 챔피언의 스탯을 정밀하게 관리하고 비교하세요", icon: Shield, color: '#3b82f6', img: featureList },
    { num: '02', title: "퀘스트 시뮬레이션", desc: "던전에 파티를 보내 결과를 미리 확인하세요", icon: Swords, color: '#ef4444', img: featureQuest },
    { num: '03', title: "랭킹", desc: "다른 플레이어와 시뮬레이션 결과를 비교하세요", icon: Trophy, color: '#eab308', img: featureRanking },
  ];

  return (
    <div className="min-h-[200vh] bg-background relative overflow-hidden">
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
          0%, 100% { filter: drop-shadow(0 0 20px rgba(200,147,10,0.3)) drop-shadow(0 0 40px rgba(200,147,10,0.1)); }
          50% { filter: drop-shadow(0 0 30px rgba(200,147,10,0.5)) drop-shadow(0 0 60px rgba(200,147,10,0.2)); }
        }
        @keyframes subtitleReveal {
          0% { opacity: 0; letter-spacing: 0.5em; }
          100% { opacity: 1; letter-spacing: 0.2em; }
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
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
          animation: btnShine 3s ease-in-out infinite;
        }
      `}</style>

      {/* Background image - single, scrolls with page */}
      <div className="absolute inset-x-0 top-0 z-0 pointer-events-none">
        <div className="relative w-full" style={{ height: '200vh' }}>
          <img src={landingBg} alt="" className="w-full h-full object-cover" width={1920} height={1280} />
          {/* Dark overlay on top portion for title readability */}
          <div className="absolute top-0 left-0 right-0 h-[50%]" style={{
            background: 'linear-gradient(180deg, rgba(5,8,20,0.85) 0%, rgba(10,15,30,0.6) 40%, transparent 100%)'
          }} />
          {/* Bottom fade */}
          <div className="absolute bottom-0 left-0 right-0 h-[20%]" style={{
            background: 'linear-gradient(0deg, rgba(10,10,15,0.95) 0%, transparent 100%)'
          }} />
        </div>
      </div>

      {/* Stars overlay */}
      <div ref={starsRef} className="fixed inset-0 z-[1] pointer-events-none" style={{
        opacity: Math.max(0, 1 - scrollY / 1200),
      }} />

      {/* Shooting stars */}
      <div ref={shootingStarsRef} className="fixed inset-0 z-[1] pointer-events-none" />

      {/* Rising particles (embers) */}
      <div ref={particlesRef} className="absolute inset-x-0 z-[3] pointer-events-none" style={{ top: '60vh', height: '140vh' }} />

      {/* ===== HERO SECTION ===== */}
      <div className="relative z-10 min-h-screen flex items-center justify-center">
        <div className="text-center px-4 py-20" style={{
          opacity: Math.max(0, 1 - scrollY / 600),
        }}>
          <div className="mb-6" style={{ animation: 'logoFloat 6s ease-in-out infinite' }}>
            <span className="font-display text-[11px] tracking-[0.2em] uppercase block mb-4" style={{
              color: 'hsl(40 50% 45%)',
              animation: 'subtitleReveal 1.5s ease-out forwards',
            }}>
              셀레노필 제작
            </span>
            <h1
              className="mx-auto select-none"
              style={{
                fontFamily: "'Noto Sans KR', sans-serif",
                fontWeight: 900,
                fontSize: 'clamp(2rem, 6vw, 3.5rem)',
                lineHeight: 1.2,
                letterSpacing: '0.04em',
                background: 'linear-gradient(180deg, #ffd97a 0%, #e8b830 30%, #c8930a 60%, #a06818 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                textShadow: 'none',
                filter: 'drop-shadow(0 2px 8px rgba(200,147,10,0.5)) drop-shadow(0 0 40px rgba(200,147,10,0.15))',
                animation: 'glowPulse 4s ease-in-out infinite',
                maxWidth: '80vw',
              }}
            >
              샵타이탄<br />퀘스트 시뮬레이터
            </h1>
          </div>

          <p className="text-muted-foreground text-base md:text-lg max-w-xl mx-auto mb-12 leading-relaxed">
            영웅과 챔피언을 관리하고, 미리 던전에 보내<br />
            최적의 전략을 찾아보세요.
          </p>

          <Button
            size="lg"
            onClick={() => navigate("/dashboard")}
            className="btn-shine text-base px-12 py-7 font-display tracking-wider relative group
              transition-all duration-300 ease-out
              hover:scale-105 hover:shadow-[0_0_30px_rgba(200,147,10,0.4),0_0_60px_rgba(200,147,10,0.15)]
              active:scale-95"
            style={{
              background: 'linear-gradient(135deg, hsl(40 85% 45%), hsl(30 80% 40%))',
              boxShadow: '0 0 20px rgba(200,147,10,0.2), 0 4px 20px rgba(0,0,0,0.3)',
            }}
          >
            <Swords className="w-5 h-5 mr-1 transition-transform duration-300 group-hover:rotate-12" />
            시작하기
          </Button>

          <div className="mt-20 animate-bounce opacity-40">
            <div className="w-6 h-10 rounded-full border-2 border-foreground/30 mx-auto flex justify-center pt-2">
              <div className="w-1 h-3 bg-foreground/40 rounded-full" />
            </div>
          </div>
        </div>
      </div>

      {/* ===== FEATURES SECTION ===== */}
      <div className="relative z-10 max-w-5xl mx-auto px-6 pb-32" style={{ marginTop: '-4rem' }}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {features.map((f, i) => {
            const Icon = f.icon;
            const isHovered = hoveredFeature === i;
            return (
              <div
                key={f.title}
                className="relative cursor-pointer select-none"
                onMouseEnter={() => setHoveredFeature(i)}
                onMouseLeave={() => setHoveredFeature(null)}
                onClick={() => navigate("/dashboard")}
                style={{
                  transform: isHovered ? 'translateY(-6px) scale(1.02)' : 'translateY(0) scale(1)',
                  transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
                }}
              >
                <div
                  className="rounded-xl overflow-hidden relative"
                  style={{
                    border: `1px solid ${isHovered ? f.color + '80' : 'hsl(230 12% 22%)'}`,
                    boxShadow: isHovered
                      ? `0 8px 32px rgba(0,0,0,0.4), 0 0 24px ${f.color}30`
                      : '0 2px 8px rgba(0,0,0,0.3)',
                    transition: 'all 0.3s ease',
                  }}
                >
                  {/* Card background image */}
                  <div className="relative h-40 overflow-hidden">
                    <img
                      src={f.img}
                      alt={f.title}
                      className="w-full h-full object-cover transition-transform duration-500"
                      loading="lazy"
                      style={{
                        transform: isHovered ? 'scale(1.08)' : 'scale(1)',
                      }}
                    />
                    <div className="absolute inset-0" style={{
                      background: `linear-gradient(180deg, transparent 30%, rgba(15,15,25,0.95) 100%)`,
                    }} />
                    {/* Top accent line */}
                    <div className="absolute top-0 left-0 right-0 h-[2px]" style={{
                      background: `linear-gradient(90deg, transparent, ${f.color}${isHovered ? 'cc' : '40'}, transparent)`,
                      transition: 'all 0.3s ease',
                    }} />
                    {/* Icon overlay */}
                    <div className="absolute top-3 right-3 w-8 h-8 rounded-lg flex items-center justify-center" style={{
                      background: 'rgba(0,0,0,0.5)',
                      border: `1px solid ${f.color}40`,
                    }}>
                      <Icon className="w-4 h-4" style={{ color: f.color }} />
                    </div>
                  </div>

                  {/* Card content */}
                  <div className="p-4" style={{ background: 'hsl(230 15% 10%)' }}>
                    <span className="font-display text-[10px] tracking-[0.3em] block mb-1" style={{ color: f.color + '60' }}>{f.num}</span>
                    <h3 className="text-sm mb-1.5 font-bold" style={{ color: isHovered ? f.color : 'hsl(40 85% 55%)', transition: 'color 0.3s ease' }}>{f.title}</h3>
                    <p className="text-muted-foreground text-xs leading-relaxed">{f.desc}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default Index;
