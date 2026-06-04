import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { AlertTriangle, Loader2, CheckCircle2, XCircle } from "lucide-react";

const NICK_REGEX = /^[가-힣A-Za-z0-9_]{3,16}$/;

export default function OnboardingDialog() {
  const { user, needsOnboarding, pendingGoogleSub, refreshProfile, signOut } = useAuth();
  const [nickname, setNickname] = useState("");
  const [checkState, setCheckState] = useState<"idle" | "checking" | "available" | "taken" | "invalid">("idle");
  const [agree1, setAgree1] = useState(false);
  const [agree2, setAgree2] = useState(false);
  const [agree3, setAgree3] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!needsOnboarding) {
      setNickname("");
      setAgree1(false); setAgree2(false); setAgree3(false);
      setCheckState("idle");
    }
  }, [needsOnboarding]);

  useEffect(() => {
    if (!nickname) { setCheckState("idle"); return; }
    if (!NICK_REGEX.test(nickname)) { setCheckState("invalid"); return; }
    setCheckState("checking");
    const handle = setTimeout(async () => {
      const { count, error } = await supabase
        .from("profiles")
        .select("user_id", { count: "exact", head: true })
        .ilike("nickname", nickname);
      if (error) { setCheckState("idle"); return; }
      setCheckState((count ?? 0) > 0 ? "taken" : "available");
    }, 400);
    return () => clearTimeout(handle);
  }, [nickname]);

  const canSubmit = checkState === "available" && agree1 && agree2 && agree3 && !submitting;

  const handleClose = async (open: boolean) => {
    if (!open && needsOnboarding) {
      // Force sign out if user dismisses without completing
      await signOut();
    }
  };

  const handleSubmit = async () => {
    if (!user || !canSubmit) return;
    setSubmitting(true);
    const { error } = await supabase.from("profiles").insert({
      user_id: user.id,
      nickname,
      google_sub: pendingGoogleSub,
      email: user.email ?? null,
      agreed_at: new Date().toISOString(),
    });
    if (error) {
      if (error.code === "23505") {
        setCheckState("taken");
        toast({ title: "닉네임 중복", description: "이미 사용 중인 닉네임입니다.", variant: "destructive" });
      } else {
        toast({ title: "프로필 생성 실패", description: error.message, variant: "destructive" });
      }
      setSubmitting(false);
      return;
    }
    await refreshProfile();
    toast({ title: "환영합니다!", description: `${nickname} 님, 모험을 시작하세요.` });
    setSubmitting(false);
  };

  return (
    <Dialog open={needsOnboarding} onOpenChange={handleClose}>
      <DialogContent className="max-w-md" onPointerDownOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>닉네임 설정</DialogTitle>
          <DialogDescription>
            가급적 인게임과 일치하는 닉네임을 입력해주세요.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="nickname">닉네임</Label>
            <Input
              id="nickname"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="3~16자, 한글/영문/숫자/_"
              maxLength={16}
              autoFocus
            />
            <div className="mt-1 h-5 text-xs flex items-center gap-1">
              {checkState === "checking" && (<><Loader2 className="w-3 h-3 animate-spin" /> 중복 확인 중…</>)}
              {checkState === "invalid" && (<span className="text-destructive">3~16자, 한글/영문/숫자/_ 만 사용</span>)}
              {checkState === "taken" && (<span className="text-destructive flex items-center gap-1"><XCircle className="w-3 h-3" /> 이미 사용 중인 닉네임입니다</span>)}
              {checkState === "available" && (<span className="text-green-500 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> 사용 가능한 닉네임</span>)}
            </div>
          </div>

          <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs flex gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-500 mt-0.5" />
            <p className="text-amber-200">
              선정적·정치적·비속어 등 논란이 될 닉네임은 운영자에 의해 계정이 삭제되고 재가입이 차단될 수 있습니다.
            </p>
          </div>

          <div className="space-y-2 text-sm">
            <label className="flex items-start gap-2 cursor-pointer">
              <Checkbox checked={agree1} onCheckedChange={(c) => setAgree1(!!c)} className="mt-0.5" />
              <span>내 닉네임과 성공률 80% 이상의 시뮬레이션 결과가 서버에 자동 저장·활용되는 것에 동의합니다.</span>
            </label>
            <label className="flex items-start gap-2 cursor-pointer">
              <Checkbox checked={agree2} onCheckedChange={(c) => setAgree2(!!c)} className="mt-0.5" />
              <span>논란이 될 닉네임 사용 시 관리자에 의해 계정이 삭제되고 동일 구글 계정으로 재가입이 차단될 수 있음에 동의합니다.</span>
            </label>
            <label className="flex items-start gap-2 cursor-pointer">
              <Checkbox checked={agree3} onCheckedChange={(c) => setAgree3(!!c)} className="mt-0.5" />
              <span>1년 이상 미접속 시 서버 용량 확보를 위해 계정이 자동 삭제될 수 있음에 동의합니다.</span>
            </label>
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <Button variant="ghost" onClick={() => signOut()}>취소</Button>
            <Button onClick={handleSubmit} disabled={!canSubmit}>
              {submitting && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
              시작하기
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
