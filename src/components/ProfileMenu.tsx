import { useAuth } from "@/hooks/use-auth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogOut, Download, UserCircle2 } from "lucide-react";
import { saveBlobFile } from "@/lib/fileDownload";
import { getHeroes, getSimulations } from "@/lib/storage";
import { getSavedSimulations } from "@/lib/savedSimulations";
import { toast } from "@/hooks/use-toast";

export default function ProfileMenu() {
  const { user, profile, signInWithGoogle, signOut } = useAuth();

  if (!user || !profile) {
    return (
      <button
        onClick={signInWithGoogle}
        className="flex items-center gap-1.5 px-3 h-8 rounded-md text-sm font-medium border border-border bg-secondary/50 hover:bg-secondary transition-colors"
      >
        <UserCircle2 className="w-4 h-4" />
        <span>로그인</span>
      </button>
    );
  }

  const handleExport = async () => {
    try {
      const heroes = getHeroes();
      const sims = getSimulations();
      const savedSims = getSavedSimulations();
      const payload = {
        exportedAt: new Date().toISOString(),
        nickname: profile.nickname,
        heroes,
        simulations: sims,
        savedSimulations: savedSims,
      };
      const text = JSON.stringify(payload, null, 2);
      const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
      const filename = `quest-sim-export-${profile.nickname}-${Date.now()}.txt`;
      await saveBlobFile(blob, filename, "내 데이터 텍스트 파일을 저장하세요.");
    } catch (e) {
      toast({ title: "추출 실패", description: String(e), variant: "destructive" });
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          title={profile.nickname}
          className="flex items-center gap-1.5 px-3 h-8 rounded-md text-sm font-medium border border-primary/40 bg-primary/10 hover:bg-primary/20 text-primary transition-colors max-w-[160px]"
        >
          <UserCircle2 className="w-4 h-4 shrink-0" />
          <span className="truncate">{profile.nickname}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <div className="flex flex-col">
            <span className="font-medium">{profile.nickname}</span>
            {user.email && <span className="text-xs text-muted-foreground truncate">{user.email}</span>}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleExport} className="cursor-pointer">
          <Download className="w-4 h-4 mr-2" />
          내 데이터 추출
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => signOut()} className="cursor-pointer">
          <LogOut className="w-4 h-4 mr-2" />
          로그아웃
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
