// Preserved landing features intro section (formerly shown on Index).
// Kept for future reuse as a first-time visitor introduction screen.
// Currently unused/unimported — do NOT auto-render.
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { Swords, Shield, Trophy } from "lucide-react";

import featureList from "@/assets/feature-list.jpg";
import featureQuest from "@/assets/feature-quest.jpg";
import featureRanking from "@/assets/feature-ranking.jpg";

export default function LandingFeaturesIntro() {
  const navigate = useNavigate();
  const [hoveredFeature, setHoveredFeature] = useState<number | null>(null);

  const features = [
    { num: '01', title: "리스트 관리", desc: "영웅과 챔피언의 스탯을 정밀하게 관리하고 비교하세요", icon: Shield, color: '#3b82f6', img: featureList },
    { num: '02', title: "퀘스트 시뮬레이션", desc: "던전에 파티를 보내 결과를 미리 확인하세요", icon: Swords, color: '#ef4444', img: featureQuest },
    { num: '03', title: "랭킹", desc: "다른 플레이어와 시뮬레이션 결과를 비교하세요", icon: Trophy, color: '#eab308', img: featureRanking },
  ];

  return (
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
                <div className="relative h-40 overflow-hidden">
                  <img src={f.img} alt={f.title} className="w-full h-full object-cover transition-transform duration-500" loading="lazy" style={{ transform: isHovered ? 'scale(1.08)' : 'scale(1)' }} />
                  <div className="absolute inset-0" style={{ background: `linear-gradient(180deg, transparent 30%, rgba(15,15,25,0.95) 100%)` }} />
                  <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: `linear-gradient(90deg, transparent, ${f.color}${isHovered ? 'cc' : '40'}, transparent)`, transition: 'all 0.3s ease' }} />
                  <div className="absolute top-3 right-3 w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.5)', border: `1px solid ${f.color}40` }}>
                    <Icon className="w-4 h-4" style={{ color: f.color }} />
                  </div>
                </div>
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
  );
}
