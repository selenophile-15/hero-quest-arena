import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Swords } from "lucide-react";
import heroBanner from "@/assets/hero-banner.jpg";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-fantasy-gradient flex flex-col">
      {/* Hero Section */}
      <div className="relative flex-1 flex items-center justify-center overflow-hidden">
        {/* Background Image */}
        <div className="absolute inset-0">
          <img src={heroBanner} alt="" className="w-full h-full object-cover opacity-40" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-background/30" />
        </div>

        {/* Content */}
        <div className="relative z-10 text-center px-4 py-20 animate-fade-in">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 mb-6">
            <Swords className="w-4 h-4 text-primary" />
            <span className="text-sm text-primary font-medium">Quest Simulator</span>
          </div>

          <h1 className="font-display text-4xl md:text-6xl lg:text-7xl text-gold-gradient mb-4 leading-tight">
            샵타이탄
            <br />
            퀘스트 시뮬레이터
          </h1>

          <p className="text-muted-foreground text-lg md:text-xl max-w-xl mx-auto mb-10 leading-relaxed">
            영웅과 챔피언을 관리하고, 최적의 전략을 찾아보세요.
          </p>

          <Button
            size="lg"
            onClick={() => navigate("/dashboard")}
            className="text-base px-8 py-6 glow-gold animate-glow-pulse"
          >
            시작하기
          </Button>
        </div>
      </div>

      {/* Features */}
      <div className="relative z-10 max-w-4xl mx-auto px-4 pb-16 grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { title: "리스트 관리", desc: "영웅과 챔피언의 스탯을 자동으로 확인하고 관리하세요" },
          { title: "퀘스트 시뮬레이션", desc: "던전에 파티를 보내 결과를 미리 확인하세요" },
          { title: "랭킹", desc: "다른 플레이어와 시뮬레이션 결과를 비교하세요" },
        ].map((f) => (
          <div key={f.title} className="card-fantasy p-5">
            <h3 className="font-display text-primary text-sm mb-2">{f.title}</h3>
            <p className="text-muted-foreground text-sm leading-relaxed">{f.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Index;
