import {
  AlertCircle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  CircleDollarSign,
  Landmark,
  Plus,
  ReceiptText,
  WalletCards,
} from "lucide-react";
import { useMemo, type ReactNode } from "react";
import {
  emptyPhase2Data,
  type DividendEntry,
  type InvestmentTrade,
} from "./domain";
import { buildFinanceHomeSummary } from "./financeHomeModel";
import type { FinanceSection } from "./FinanceWorkspaceShell";
import { formatKrw, localToday } from "./presentation";
import type { FinanceSnapshot } from "./repository";

type Props = Readonly<{
  snapshot: FinanceSnapshot;
  onNavigate: (section: FinanceSection) => void;
  onAddIncome: () => void;
  writable: boolean;
}>;

export function FinanceHome({
  snapshot,
  onNavigate,
  onAddIncome,
  writable,
}: Props) {
  const phase2 = snapshot.phase2 ?? emptyPhase2Data();
  const year = new Date().getFullYear();
  const home = useMemo(() => {
    try {
      return {
        summary: buildFinanceHomeSummary(
          snapshot.income,
          phase2,
          year,
          localToday(),
        ),
        failed: false,
      } as const;
    } catch {
      return { summary: null, failed: true } as const;
    }
  }, [snapshot, phase2, year]);
  if (home.failed || !home.summary) {
    return (
      <section className="finance-home" aria-labelledby="finance-home-title">
        <header className="finance-view-header">
          <div>
            <p className="finance-eyebrow">FINANCIAL HOME</p>
            <h1 id="finance-home-title">재무 홈</h1>
            <p>수입, 자산, 투자와 세금 현황을 한곳에서 확인하세요.</p>
          </div>
        </header>
        <div
          className="finance-home-panel finance-home-calculation-error"
          role="alert"
        >
          <AlertCircle size={20} />
          <div>
            <h2>재무 요약을 계산하지 못했습니다</h2>
            <p>
              저장된 원본 값은 변경하지 않았습니다. 투자 거래와 평가 기준을
              확인해 주세요.
            </p>
          </div>
        </div>
      </section>
    );
  }
  const summary = home.summary;
  const maxMonth = Math.max(1, ...summary.monthlyIncomeKrw);
  const assetTotal = Math.max(1, summary.totalAssetsKrw);
  const recentIncome = [...snapshot.income]
    .sort((a, b) => b.earnedOn.localeCompare(a.earnedOn))
    .slice(0, 3);
  const recentTrades = [...phase2.trades]
    .sort((a, b) => b.tradedOn.localeCompare(a.tradedOn))
    .slice(0, 3);
  const recentDividends = [...phase2.dividends]
    .sort((a, b) => b.paidOn.localeCompare(a.paidOn))
    .slice(0, 3);
  const valuationDates = phase2.instruments.map((item) => item.valuedOn).sort();
  const valuedOn = valuationDates[valuationDates.length - 1];
  const valuationContext = [
    ...new Set(
      phase2.instruments.map(
        (item) =>
          `${item.currency} · 환율 ${(item.valuationExchangeRateMicros / 1_000_000).toLocaleString("ko-KR")}`,
      ),
    ),
  ].join(" / ");

  return (
    <section className="finance-home" aria-labelledby="finance-home-title">
      <header className="finance-view-header">
        <div>
          <p className="finance-eyebrow">FINANCIAL HOME</p>
          <h1 id="finance-home-title">재무 홈</h1>
          <p>수입, 자산, 투자와 세금 현황을 한곳에서 확인하세요.</p>
        </div>
        <button
          type="button"
          className="finance-primary"
          disabled={!writable}
          onClick={onAddIncome}
        >
          <Plus size={16} /> 수입 등록
        </button>
      </header>

      <section className="finance-home-kpis" aria-label="재무 핵심 지표">
        <Kpi
          icon={<WalletCards size={18} />}
          label="총자산"
          value={formatKrw(summary.totalAssetsKrw)}
          note={`부채 ${formatKrw(summary.liabilitiesKrw)}`}
        />
        <Kpi
          icon={<CircleDollarSign size={18} />}
          label="순자산"
          value={formatKrw(summary.netWorthKrw)}
          note="총자산에서 부채를 차감"
        />
        <Kpi
          icon={<ReceiptText size={18} />}
          label={`${year}년 총소득`}
          value={formatKrw(summary.annualIncomeKrw)}
          note={`배당 ${formatKrw(summary.annualDividendKrw)} 포함`}
        />
        <Kpi
          icon={<Landmark size={18} />}
          label="투자 평가액"
          value={formatKrw(summary.investmentKrw)}
          note={`평가손익 ${resultText(summary.unrealizedKrw)} · 실현손익 ${resultText(summary.realizedKrw)}`}
          detail={
            valuedOn
              ? `최근 평가 기준일 ${valuedOn} · ${valuationContext}`
              : "등록된 평가 기준 없음"
          }
        />
      </section>

      <div className="finance-home-grid">
        <section className="finance-home-panel finance-income-flow">
          <header>
            <div>
              <p className="finance-eyebrow">INCOME FLOW</p>
              <h2>{year}년 월별 수입</h2>
            </div>
            <button
              type="button"
              aria-label="월별 수입 상세 보기"
              onClick={() => onNavigate("income")}
            >
              수입 관리 <ArrowRight size={14} />
            </button>
          </header>
          <div
            className="finance-month-chart"
            aria-label={`${year}년 월별 총수입 차트`}
          >
            {summary.monthlyIncomeKrw.map((amount, index) => (
              <div className="finance-month" key={index}>
                <div className="finance-month-bar">
                  <span
                    role="img"
                    aria-label={`${index + 1}월 ${formatKrw(amount)}`}
                    style={{
                      height: `${Math.max(amount > 0 ? 8 : 2, (amount / maxMonth) * 100)}%`,
                    }}
                  />
                </div>
                <small>{index + 1}월</small>
              </div>
            ))}
          </div>
        </section>

        <section className="finance-home-panel finance-assets-chart">
          <header>
            <div>
              <p className="finance-eyebrow">ASSET MIX</p>
              <h2>현재 자산 구성</h2>
            </div>
            <button type="button" onClick={() => onNavigate("assets")}>
              자산·부채 <ArrowRight size={14} />
            </button>
          </header>
          <div
            className="finance-asset-bar"
            aria-label="자산 구성 가로 누적 막대"
          >
            <span
              className="is-manual"
              style={{
                width: `${summary.totalAssetsKrw === 0 ? 0 : summary.totalAssetsKrw === summary.investmentKrw ? 0 : ((summary.totalAssetsKrw - summary.investmentKrw) / assetTotal) * 100}%`,
              }}
            />
            <span
              className="is-investment"
              style={{
                width: `${(summary.investmentKrw / assetTotal) * 100}%`,
              }}
            />
          </div>
          <dl className="finance-asset-list">
            <div>
              <dt>
                <i className="is-manual" />
                현금·예금·적금
              </dt>
              <dd>
                {formatKrw(summary.totalAssetsKrw - summary.investmentKrw)}
              </dd>
            </div>
            <div>
              <dt>
                <i className="is-investment" />
                증권 평가액
              </dt>
              <dd>{formatKrw(summary.investmentKrw)}</dd>
            </div>
            <div>
              <dt>총부채</dt>
              <dd className="is-negative">
                -{formatKrw(summary.liabilitiesKrw)}
              </dd>
            </div>
          </dl>
        </section>

        <RecentIncome
          items={recentIncome}
          onNavigate={() => onNavigate("income")}
        />
        <RecentInvestments
          trades={recentTrades}
          dividends={recentDividends}
          instruments={phase2.instruments}
          onNavigate={() => onNavigate("investments")}
        />
      </div>

      <div className="finance-home-bottom">
        <section className="finance-home-panel finance-attention">
          <header>
            <div>
              <p className="finance-eyebrow">CHECK</p>
              <h2>확인할 항목</h2>
            </div>
          </header>
          {summary.unpaidCount === 0 && summary.unverifiedCount === 0 ? (
            <p className="finance-clear">
              <CircleDollarSign size={18} /> 현재 확인할 수입 항목이 없습니다.
            </p>
          ) : (
            <ul>
              {summary.unpaidCount > 0 && (
                <li>
                  <AlertCircle size={17} />
                  <span>
                    미입금 수입 <strong>{summary.unpaidCount}건</strong>
                  </span>
                  <button onClick={() => onNavigate("income")}>확인</button>
                </li>
              )}
              {summary.unverifiedCount > 0 && (
                <li>
                  <AlertCircle size={17} />
                  <span>
                    세무 분류 미확정{" "}
                    <strong>{summary.unverifiedCount}건</strong>
                  </span>
                  <button onClick={() => onNavigate("tax")}>확인</button>
                </li>
              )}
            </ul>
          )}
        </section>
        <section className="finance-home-panel finance-quick-actions">
          <header>
            <div>
              <p className="finance-eyebrow">QUICK ACTIONS</p>
              <h2>주요 기능</h2>
            </div>
          </header>
          <div>
            <button
              type="button"
              aria-label="빠른 수입 등록"
              onClick={onAddIncome}
              disabled={!writable}
            >
              <Plus size={16} />
              수입 등록
            </button>
            <button type="button" onClick={() => onNavigate("investments")}>
              <ArrowUpRight size={16} />
              투자 기록
            </button>
            <button
              type="button"
              aria-label="빠른 백업·복원"
              onClick={() => onNavigate("backup")}
            >
              <ArrowDownRight size={16} />
              백업·복원
            </button>
          </div>
        </section>
      </div>
    </section>
  );
}

function resultText(value: number): string {
  if (value > 0) return `이익 +${formatKrw(value)}`;
  if (value < 0) return `손실 ${formatKrw(value)}`;
  return `변동 없음 ${formatKrw(0)}`;
}

function Kpi({
  icon,
  label,
  value,
  note,
  detail,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  note: string;
  detail?: string;
}) {
  return (
    <article className="finance-kpi">
      <div>
        <span>{icon}</span>
        <p>{label}</p>
      </div>
      <strong>{value}</strong>
      <small>{note}</small>
      {detail && <small>{detail}</small>}
    </article>
  );
}

function RecentIncome({
  items,
  onNavigate,
}: {
  items: FinanceSnapshot["income"];
  onNavigate: () => void;
}) {
  return (
    <section className="finance-home-panel finance-recent">
      <header>
        <div>
          <p className="finance-eyebrow">RECENT</p>
          <h2>최근 수입</h2>
        </div>
        <button onClick={onNavigate}>
          전체 보기 <ArrowRight size={14} />
        </button>
      </header>
      {items.length === 0 ? (
        <p className="finance-home-empty">등록된 수입이 없습니다.</p>
      ) : (
        <ul>
          {items.map((item) => (
            <li key={item.id}>
              <div>
                <strong>{item.sourceName}</strong>
                <span>{item.earnedOn}</span>
              </div>
              <b>{formatKrw(item.grossKrw)}</b>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function RecentInvestments({
  trades,
  dividends,
  instruments,
  onNavigate,
}: {
  trades: readonly InvestmentTrade[];
  dividends: readonly DividendEntry[];
  instruments: readonly { id: string; name: string }[];
  onNavigate: () => void;
}) {
  const items = [
    ...trades.map((trade) => ({
      id: `trade-${trade.id}`,
      date: trade.tradedOn,
      instrumentId: trade.instrumentId,
      label: trade.kind === "buy" ? "매수" : "매도",
      positive: trade.kind === "sell",
    })),
    ...dividends.map((entry) => ({
      id: `dividend-${entry.id}`,
      date: entry.paidOn,
      instrumentId: entry.instrumentId,
      label: "배당",
      positive: true,
    })),
  ]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 3);
  return (
    <section className="finance-home-panel finance-recent">
      <header>
        <div>
          <p className="finance-eyebrow">RECENT</p>
          <h2>최근 투자 거래·배당</h2>
        </div>
        <button onClick={onNavigate}>
          투자 관리 <ArrowRight size={14} />
        </button>
      </header>
      {items.length === 0 ? (
        <p className="finance-home-empty">
          등록된 투자 거래와 배당이 없습니다.
        </p>
      ) : (
        <ul>
          {items.map((item) => (
            <li key={item.id}>
              <div>
                <strong>
                  {instruments.find(
                    (instrument) => instrument.id === item.instrumentId,
                  )?.name ?? "종목"}
                </strong>
                <span>{item.date}</span>
              </div>
              <b className={item.positive ? "is-positive" : ""}>{item.label}</b>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
