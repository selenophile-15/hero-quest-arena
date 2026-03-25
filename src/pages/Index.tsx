import { useNavigate } from "react-router-dom";
import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Swords } from "lucide-react";
import heroBanner from "@/assets/hero-banner.jpg";

const Index = () => {
  const navigate = useNavigate();
  const starsRef = useRef<HTMLDivElement>(null);
  const particlesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Create twinkling stars
    const starsEl = starsRef.current;
    if (starsEl && starsEl.childElementCount === 0) {
      for (let i = 0; i < 120; i++) {
        const s = document.createElement('div');
        const size = Math.random() * 1.5 + 0.5;
        s.style.cssText = `position:absolute;background:#fff;border-radius:50%;left:${Math.random()*100}%;top:${Math.random()*100}%;width:${size}px;height:${size}px;animation:twinkle ${2+Math.random()*4}s linear infinite;animation-delay:${Math.random()*6}s;opacity:${Math.random()*0.5+0.1}`;
        starsEl.appendChild(s);
      }
    }

    // Create rising particles
    const pEl = particlesRef.current;
    if (pEl && pEl.childElementCount === 0) {
      const colors = ['#c8930a','#e8b830','#d4a020','#f0d060','#a06818'];
      for (let i = 0; i < 30; i++) {
        const d = document.createElement('div');
        const size = 1 + Math.random() * 2;
        d.style.cssText = `position:absolute;border-radius:50%;left:${Math.random()*100}%;bottom:0;width:${size}px;height:${size}px;background:${colors[Math.floor(Math.random()*colors.length)]};animation:rise ${10+Math.random()*15}s linear infinite;animation-delay:${Math.random()*10}s;`;
        pEl.appendChild(d);
      }
    }
  }, []);

  return (
    <div className="min-h-screen bg-fantasy-gradient flex flex-col">
      <style>{`
        @keyframes twinkle {
          0%, 100% { opacity: 0; }
          50% { opacity: 1; }
        }
        @keyframes rise {
          0% { transform: translateY(0) scale(0.5); opacity: 0; }
          15% { opacity: 0.8; }
          85% { opacity: 0.4; }
          100% { transform: translateY(-90vh) scale(1.2); opacity: 0; }
        }
      `}</style>

      {/* Hero Section */}
      <div className="relative flex-1 flex items-center justify-center overflow-hidden min-h-screen">
        {/* Background Image */}
        <div className="absolute inset-0">
          <img src={heroBanner} alt="" className="w-full h-full object-cover opacity-35" width={1920} height={1080} />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-background/20" />
          {/* Horizon glow */}
          <div className="absolute bottom-0 left-0 right-0 h-72" style={{
            background: 'linear-gradient(0deg, rgba(180,60,10,0.15) 0%, rgba(120,30,80,0.08) 40%, transparent 100%)'
          }} />
        </div>

        {/* Stars */}
        <div ref={starsRef} className="absolute inset-0 z-[1] pointer-events-none" />

        {/* Rising particles */}
        <div ref={particlesRef} className="absolute inset-0 z-[2] pointer-events-none" />

        {/* Content */}
        <div className="relative z-10 text-center px-4 py-20 animate-fade-in">
          {/* Eyebrow */}
          <div className="inline-flex items-center gap-3 mb-10">
            <div className="w-10 h-px" style={{ background: 'linear-gradient(90deg, transparent, hsl(40 50% 35%))' }} />
            <span className="font-display text-[11px] tracking-[0.4em] uppercase" style={{ color: 'hsl(40 50% 35%)' }}>
              Quest Simulator
            </span>
            <div className="w-10 h-px" style={{ background: 'linear-gradient(90deg, hsl(40 50% 35%), transparent)' }} />
          </div>

          <h1 className="mb-4 leading-tight">
            <span className="block text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight" style={{
              background: 'linear-gradient(135deg, hsl(40 90% 60%), hsl(30 85% 50%), hsl(40 80% 45%))',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              filter: 'drop-shadow(0 0 30px rgba(200, 147, 10, 0.3))',
            }}>
              샵타이탄
            </span>
            <span className="block text-3xl md:text-5xl lg:text-6xl font-semibold mt-1" style={{
              color: 'hsl(40 15% 80%)',
              letterSpacing: '-0.02em',
            }}>
              퀘스트 시뮬레이터
            </span>
          </h1>

          <p className="text-muted-foreground text-base md:text-lg max-w-xl mx-auto mb-12 leading-relaxed">
            영웅과 챔피언을 관리하고, 미리 던전에 보내<br />
            최적의 전략을 찾아보세요.
          </p>

          <Button
            size="lg"
            onClick={() => navigate("/dashboard")}
            className="text-base px-10 py-6 glow-gold animate-glow-pulse font-display tracking-wider"
          >
            ⚔ 시작하기
          </Button>
        </div>
      </div>

      {/* Features */}
      <div className="relative z-10 max-w-4xl mx-auto px-4 pb-20 -mt-16 grid grid-cols-1 md:grid-cols-3 gap-[2px] rounded-lg overflow-hidden border border-primary/10">
        {[
          { num: '01', title: "리스트 관리", desc: "영웅과 챔피언의 스탯을 정밀하게 관리하고 비교하세요" },
          { num: '02', title: "퀘스트 시뮬레이션", desc: "던전에 파티를 보내 결과를 미리 확인하세요" },
          { num: '03', title: "랭킹", desc: "다른 플레이어와 시뮬레이션 결과를 비교하세요" },
        ].map((f) => (
          <div key={f.title} className="bg-card/85 p-6 text-center hover:bg-card transition-colors relative group">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-primary to-transparent scale-x-0 group-hover:scale-x-100 transition-transform" />
            <span className="font-display text-[10px] tracking-[0.3em] text-primary/30 block mb-3">{f.num}</span>
            <h3 className="text-primary text-sm mb-2 font-bold">{f.title}</h3>
            <p className="text-muted-foreground text-sm leading-relaxed">{f.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Index;
