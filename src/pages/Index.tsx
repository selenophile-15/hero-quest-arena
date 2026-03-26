import { useNavigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Swords, Shield, Trophy } from "lucide-react";
import selenofilLogo from "@/assets/selenofil-logo.png";
import landingBg from "@/assets/landing-bg.jpg";

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
        s.style.cssText = `position:absolute;background:#fff;border-radius:50%;left:${Math.random()*100}%;top:${Math.random()*60}%;width:${size}px;height:${size}px;animation:twinkle ${2+Math.random()*5}s ease-in-out infinite;animation-delay:${Math.random()*6}s;opacity:${brightness}`;
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
      // Initial shooting stars
      setTimeout(createShootingStar, 500);
      setTimeout(createShootingStar, 1500);
      return () => clearInterval(interval);
    }
  }, []);

  const parallaxOffset = scrollY * 0.4;

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
        @keyframes featureGlow {
          0%, 100% { box-shadow: inset 0 1px 0 rgba(200,147,10,0.1), 0 0 0 rgba(200,147,10,0); }
          50% { box-shadow: inset 0 1px 0 rgba(200,147,10,0.2), 0 0 20px rgba(200,147,10,0.05); }
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

      {/* Fixed night sky background with parallax */}
      <div className="fixed inset-0 z-0">
        {/* Sky gradient */}
        <div className="absolute inset-0" style={{
          background: 'linear-gradient(180deg, #0a0e1a 0%, #0d1428 30%, #111d3a 50%, #1a2a4a 70%, #1e3050 100%)'
        }} />
        
        {/* Stars layer */}
        <div ref={starsRef} className="absolute inset-0 pointer-events-none" style={{
          transform: `translateY(${parallaxOffset * 0.2}px)`
        }} />
        
        {/* Shooting stars */}
        <div ref={shootingStarsRef} className="absolute inset-0 pointer-events-none" />
        
        {/* Moon */}
        <div className="absolute pointer-events-none" style={{
          top: `${8 + parallaxOffset * 0.05}%`,
          right: '18%',
          width: '80px',
          height: '80px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, #f5f0d0 0%, #e8deb5 40%, #d4c98a 70%, transparent 100%)',
          boxShadow: '0 0 40px rgba(245,240,208,0.4), 0 0 80px rgba(245,240,208,0.2), 0 0 120px rgba(245,240,208,0.1)',
        }} />
      </div>

      {/* Background image - scrolls naturally with content */}
      <div className="absolute inset-x-0 z-[1] pointer-events-none" style={{
        top: '70vh',
      }}>
        <div className="relative w-full" style={{ height: '130vh' }}>
          <img src={landingBg} alt="" className="w-full h-full object-cover" style={{ opacity: 0.7 }} />
          {/* Top gradient blend into sky */}
          <div className="absolute top-0 left-0 right-0 h-[40%]" style={{
            background: 'linear-gradient(180deg, #111d3a 0%, transparent 100%)'
          }} />
          {/* Bottom warm glow */}
          <div className="absolute bottom-0 left-0 right-0 h-[30%]" style={{
            background: 'linear-gradient(0deg, rgba(30,10,5,0.9) 0%, rgba(40,20,10,0.4) 40%, transparent 100%)'
          }} />
        </div>
      </div>

      {/* Rising particles (embers) - absolute so they scroll with page */}
      <div ref={particlesRef} className="absolute inset-0 z-[3] pointer-events-none" style={{ top: '80vh', height: '120vh' }} />

      {/* ===== HERO SECTION ===== */}
      <div className="relative z-10 min-h-screen flex items-center justify-center">
        <div className="text-center px-4 py-20" style={{
          transform: `translateY(${parallaxOffset * -0.15}px)`,
          opacity: Math.max(0, 1 - scrollY / 600),
        }}>
          {/* Title area */}
          <div className="mb-6" style={{ animation: 'logoFloat 6s ease-in-out infinite' }}>
            {/* "셀레노필이 제작한" small label */}
            <span className="font-display text-[11px] tracking-[0.2em] uppercase block mb-3" style={{ 
              color: 'hsl(40 50% 45%)',
              animation: 'subtitleReveal 1.5s ease-out forwards',
            }}>
              Selenofil Presents
            </span>
            {/* Main title: 샵타이탄 퀘스트 시뮬레이터 */}
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight" style={{
              background: 'linear-gradient(135deg, hsl(40 90% 65%), hsl(35 85% 50%), hsl(40 90% 70%))',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              animation: 'glowPulse 4s ease-in-out infinite',
              textShadow: 'none',
              lineHeight: 1.2,
            }}>
              샵타이탄
            </h1>
            <h2 className="text-2xl md:text-3xl font-semibold mt-1" style={{
              color: 'hsl(40 15% 80%)',
              letterSpacing: '0.05em',
            }}>
              퀘스트 시뮬레이터
            </h2>
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

          {/* Scroll indicator */}
          <div className="mt-20 animate-bounce opacity-40">
            <div className="w-6 h-10 rounded-full border-2 border-foreground/30 mx-auto flex justify-center pt-2">
              <div className="w-1 h-3 bg-foreground/40 rounded-full" />
            </div>
          </div>
        </div>
      </div>

      {/* ===== FEATURES SECTION ===== */}
      <div className="relative z-10 max-w-5xl mx-auto px-6 pb-32" style={{
        marginTop: '-4rem',
      }}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { num: '01', title: "리스트 관리", desc: "영웅과 챔피언의 스탯을 정밀하게 관리하고 비교하세요", icon: Shield, color: '#3b82f6' },
            { num: '02', title: "퀘스트 시뮬레이션", desc: "던전에 파티를 보내 결과를 미리 확인하세요", icon: Swords, color: '#ef4444' },
            { num: '03', title: "랭킹", desc: "다른 플레이어와 시뮬레이션 결과를 비교하세요", icon: Trophy, color: '#eab308' },
          ].map((f, i) => {
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
                  className="rounded-xl p-6 text-center relative overflow-hidden"
                  style={{
                    background: isHovered 
                      ? `linear-gradient(135deg, rgba(${f.color === '#3b82f6' ? '59,130,246' : f.color === '#ef4444' ? '239,68,68' : '234,179,8'},0.15), hsl(230 15% 14%))` 
                      : 'hsl(230 15% 12%)',
                    border: `1px solid ${isHovered ? f.color + '60' : 'hsl(230 12% 22%)'}`,
                    boxShadow: isHovered 
                      ? `0 8px 32px rgba(0,0,0,0.3), 0 0 20px ${f.color}20, inset 0 1px 0 ${f.color}30`
                      : '0 2px 8px rgba(0,0,0,0.2)',
                    animation: 'featureGlow 4s ease-in-out infinite',
                    animationDelay: `${i * 0.5}s`,
                    transition: 'all 0.3s ease',
                  }}
                >
                  {/* Top accent line */}
                  <div className="absolute top-0 left-0 right-0 h-[2px]" style={{
                    background: `linear-gradient(90deg, transparent, ${f.color}${isHovered ? 'cc' : '40'}, transparent)`,
                    transition: 'all 0.3s ease',
                  }} />

                  <div className="mb-3 flex justify-center">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{
                      background: `${f.color}20`,
                      border: `1px solid ${f.color}30`,
                      transition: 'all 0.3s ease',
                      transform: isHovered ? 'scale(1.1)' : 'scale(1)',
                    }}>
                      <Icon className="w-5 h-5" style={{ color: f.color, transition: 'all 0.3s ease' }} />
                    </div>
                  </div>
                  <span className="font-display text-[10px] tracking-[0.3em] block mb-2" style={{ color: f.color + '60' }}>{f.num}</span>
                  <h3 className="text-sm mb-2 font-bold" style={{ color: isHovered ? f.color : 'hsl(40 85% 55%)' , transition: 'color 0.3s ease' }}>{f.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">{f.desc}</p>
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
