import { useState, useEffect } from 'react';
import { getResidents, getHouseholds, getFinanceTransactions, getGiftCampaigns } from '../services/db';
import { Resident, Household, FinanceTransaction, GiftCampaign } from '../types';
import { formatCurrencyVND } from '../utils/numberToWords';

export function ReportsView() {
  const [loading, setLoading] = useState(true);
  const [residents, setResidents] = useState<Resident[]>([]);
  const [households, setHouseholds] = useState<Household[]>([]);
  const [transactions, setTransactions] = useState<FinanceTransaction[]>([]);
  const [campaigns, setCampaigns] = useState<GiftCampaign[]>([]);

  useEffect(() => {
    async function load() {
      try {
        const [res, hh, tx, camp] = await Promise.all([
          getResidents(),
          getHouseholds(),
          getFinanceTransactions(),
          getGiftCampaigns(),
        ]);
        setResidents(res);
        setHouseholds(hh);
        setTransactions(tx);
        setCampaigns(camp);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // Demographic calculations
  const totalPop = residents.length;
  const males = residents.filter((r) => r.gender === 'Nam').length;
  const females = residents.filter((r) => r.gender === 'Nữ').length;

  const poor = residents.filter((r) => r.isPoorHousehold).length;
  const nearPoor = residents.filter((r) => r.isNearPoorHousehold).length;
  const policy = residents.filter((r) => r.isPolicyBeneficiary).length;
  const elderly = residents.filter((r) => r.isElderly).length;
  const disabled = residents.filter((r) => r.isDisabled).length;
  const children = residents.filter((r) => r.isChild).length;

  // Extract distinct groups dynamically from residents and households (no hardcoded defaults)
  const dynamicGroups = Array.from(
    new Set([
      ...residents.map((r) => r.groupNumber?.trim()).filter(Boolean),
      ...households.map((h) => h.groupNumber?.trim()).filter(Boolean),
    ]) as Set<string>
  ).sort((a, b) => {
    const numA = parseInt(a.replace(/\D/g, ''), 10);
    const numB = parseInt(b.replace(/\D/g, ''), 10);
    if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
    return a.localeCompare(b, 'vi');
  });

  const groupStats: { [key: string]: { residents: number; households: number } } = {};
  dynamicGroups.forEach((gName) => {
    groupStats[gName] = {
      residents: residents.filter((r) => r.groupNumber?.trim() === gName).length,
      households: households.filter((h) => h.groupNumber?.trim() === gName).length,
    };
  });

  // Finance calculations
  const approvedTx = transactions.filter((t) => t.status === 'APPROVED');
  const totalIncome = approvedTx
    .filter((t) => t.transactionType === 'INCOME')
    .reduce((sum, t) => sum + (t.amount || 0), 0);
  const totalExpense = approvedTx
    .filter((t) => t.transactionType === 'EXPENSE')
    .reduce((sum, t) => sum + (t.amount || 0), 0);
  const balance = totalIncome - totalExpense;

  // Comprehensive Category / Fund Report (Income & Expense by Category)
  interface CategoryFundReport {
    categoryName: string;
    income: number;
    expense: number;
    net: number;
    incomeCount: number;
    expenseCount: number;
    totalCount: number;
  }

  const categoryMap = new Map<string, CategoryFundReport>();

  approvedTx.forEach((tx) => {
    const cat = tx.categoryName?.trim() || 'Khoản thu chi chung';
    if (!categoryMap.has(cat)) {
      categoryMap.set(cat, {
        categoryName: cat,
        income: 0,
        expense: 0,
        net: 0,
        incomeCount: 0,
        expenseCount: 0,
        totalCount: 0,
      });
    }
    const current = categoryMap.get(cat)!;
    current.totalCount++;
    if (tx.transactionType === 'INCOME') {
      current.income += tx.amount || 0;
      current.incomeCount++;
    } else if (tx.transactionType === 'EXPENSE') {
      current.expense += tx.amount || 0;
      current.expenseCount++;
    }
    current.net = current.income - current.expense;
  });

  const categoryFundReports = Array.from(categoryMap.values()).sort(
    (a, b) => (b.income + b.expense) - (a.income + a.expense)
  );

  // Category breakdown for expense percentage
  const expenseByCategory: { [name: string]: number } = {};
  approvedTx
    .filter((t) => t.transactionType === 'EXPENSE')
    .forEach((t) => {
      expenseByCategory[t.categoryName] = (expenseByCategory[t.categoryName] || 0) + t.amount;
    });

  // Total welfare distributed
  const totalGiftsDistributed = campaigns.reduce((sum, c) => sum + (c.deliveredCount || 0), 0);
  const totalWelfareBudget = campaigns.reduce((sum, c) => sum + (c.totalBudget || 0), 0);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="w-10 h-10 border-3 border-primary border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-3 text-xs text-on-surface-variant font-medium">Đang tổng hợp báo cáo hành chính...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20">
      {/* Top Header */}
      <div className="border-b border-surface-container-high pb-4">
        <h2 className="font-headline-lg font-bold text-on-surface">
          Báo Cáo Thống Kê & Phân Tích Cơ Sở
        </h2>
        <p className="text-xs text-on-surface-variant">
          Dữ liệu trực quan hóa về dân cư, tình hình thu chi ngân sách và các chính sách an sinh xã hội
        </p>
      </div>

      {/* Overview Metric Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-surface-container-lowest p-4 rounded-2xl border border-surface-container-high shadow-xs">
          <div className="text-xs text-on-surface-variant">Tổng quy mô dân số</div>
          <div className="text-2xl font-bold text-on-surface font-numeric-data mt-1">
            {totalPop} <span className="text-xs font-normal text-slate-500">người</span>
          </div>
          <div className="text-[11px] text-primary font-medium mt-1">
            {households.length} hộ gia đình
          </div>
        </div>

        <div className="bg-surface-container-lowest p-4 rounded-2xl border border-surface-container-high shadow-xs">
          <div className="text-xs text-on-surface-variant">Tỷ lệ diện chính sách</div>
          <div className="text-2xl font-bold text-amber-800 font-numeric-data mt-1">
            {totalPop > 0 ? Math.round(((poor + nearPoor + policy) / totalPop) * 100) : 0}%
          </div>
          <div className="text-[11px] text-on-surface-variant mt-1">
            {poor + nearPoor + policy} đối tượng ưu tiên
          </div>
        </div>

        <div className="bg-surface-container-lowest p-4 rounded-2xl border border-surface-container-high shadow-xs">
          <div className="text-xs text-on-surface-variant">Tồn quỹ hiện tại</div>
          <div className="text-2xl font-black text-emerald-800 font-numeric-data mt-1">
            {formatCurrencyVND(balance)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Thu: {formatCurrencyVND(totalIncome)}
          </div>
        </div>

        <div className="bg-surface-container-lowest p-4 rounded-2xl border border-surface-container-high shadow-xs">
          <div className="text-xs text-on-surface-variant">Quà đã giải ngân</div>
          <div className="text-2xl font-bold text-primary font-numeric-data mt-1">
            {totalGiftsDistributed} <span className="text-xs font-normal text-slate-500">suất</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Trị giá: {formatCurrencyVND(totalWelfareBudget)}
          </div>
        </div>
      </div>

      {/* Grid: Demographics by Group & Classification */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Dynamic Population by Groups */}
        <div className="bg-surface-container-lowest rounded-3xl p-6 border border-surface-container-high space-y-4 shadow-xs">
          <div className="flex items-center justify-between">
            <h3 className="font-headline-sm font-bold text-on-surface">
              Phân bố Dân cư theo Tổ Dân cư
            </h3>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant font-medium">
              {dynamicGroups.length} tổ
            </span>
          </div>

          <div className="space-y-3">
            {dynamicGroups.length === 0 ? (
              <div className="py-8 text-center text-xs text-on-surface-variant italic">
                Chưa có dữ liệu phân tổ. Khi bạn nhập người dân hoặc hộ gia đình có số tổ, danh sách các tổ sẽ tự động tổng hợp và hiển thị tại đây.
              </div>
            ) : (
              dynamicGroups.map((gName) => {
                const data = groupStats[gName] || { residents: 0, households: 0 };
                const pct = totalPop > 0 ? Math.round((data.residents / totalPop) * 100) : 0;
                return (
                  <div key={gName} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="font-semibold text-slate-800">{gName}</span>
                      <span className="text-on-surface-variant font-numeric-data">
                        <span className="font-bold text-on-surface">{data.residents}</span> người ({data.households} hộ) - {pct}%
                      </span>
                    </div>
                    <div className="w-full bg-surface-container-highest rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-primary h-2 rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right: Welfare Beneficiaries Breakdown */}
        <div className="bg-surface-container-lowest rounded-3xl p-6 border border-surface-container-high space-y-4 shadow-xs">
          <h3 className="font-headline-sm font-bold text-on-surface">
            Thống kê Đối tượng Thụ hưởng Chính sách
          </h3>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-center">
            <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200">
              <div className="text-xs text-red-900 font-medium">Hộ nghèo</div>
              <div className="text-2xl font-black text-red-800 font-numeric-data mt-1">{poor}</div>
              <div className="text-[10px] text-red-700 mt-0.5">Sổ chuẩn nghèo</div>
            </div>

            <div className="p-3.5 rounded-2xl bg-orange-50 border border-orange-200">
              <div className="text-xs text-orange-900 font-medium">Hộ cận nghèo</div>
              <div className="text-2xl font-black text-orange-800 font-numeric-data mt-1">
                {nearPoor}
              </div>
              <div className="text-[10px] text-orange-700 mt-0.5">Trợ cấp y tế</div>
            </div>

            <div className="p-3.5 rounded-2xl bg-primary-fixed border border-primary/20">
              <div className="text-xs text-on-primary-fixed font-medium">Chính sách</div>
              <div className="text-2xl font-black text-primary font-numeric-data mt-1">
                {policy}
              </div>
              <div className="text-[10px] text-on-primary-fixed mt-0.5">Thương bệnh binh</div>
            </div>

            <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200">
              <div className="text-xs text-amber-900 font-medium">Người cao tuổi</div>
              <div className="text-2xl font-black text-amber-800 font-numeric-data mt-1">
                {elderly}
              </div>
              <div className="text-[10px] text-amber-700 mt-0.5">Từ 60 tuổi trở lên</div>
            </div>

            <div className="p-3.5 rounded-2xl bg-purple-50 border border-purple-200">
              <div className="text-xs text-purple-900 font-medium">Khuyết tật</div>
              <div className="text-2xl font-black text-purple-800 font-numeric-data mt-1">
                {disabled}
              </div>
              <div className="text-[10px] text-purple-700 mt-0.5">Trợ cấp xã hội</div>
            </div>

            <div className="p-3.5 rounded-2xl bg-blue-50 border border-blue-200">
              <div className="text-xs text-blue-900 font-medium">Trẻ em (&lt;16)</div>
              <div className="text-2xl font-black text-blue-800 font-numeric-data mt-1">
                {children}
              </div>
              <div className="text-[10px] text-blue-700 mt-0.5">Độ tuổi học đường</div>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-surface-container-low border border-surface-container-high flex items-center justify-between text-xs">
            <span className="text-on-surface-variant font-medium">Giới tính nhân khẩu:</span>
            <span className="font-bold text-slate-800">
              Nam: <span className="text-primary">{males}</span> • Nữ: <span className="text-amber-800">{females}</span>
            </span>
          </div>
        </div>
      </div>

      {/* COMPREHENSIVE FINANCIAL REPORT: BY FUND / CATEGORY */}
      <div className="bg-surface-container-lowest rounded-3xl p-6 border border-surface-container-high space-y-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-surface-container-high pb-4">
          <div>
            <h3 className="font-headline-sm font-bold text-on-surface">
              Báo Cáo Tài Chính: Tổng Thu - Chi Theo Hạng Mục Quỹ
            </h3>
            <p className="text-xs text-on-surface-variant mt-0.5">
              Tổng hợp chi tiết các nguồn quỹ vận động, ngân sách cơ sở và tỷ lệ giải ngân thực tế đã phê duyệt
            </p>
          </div>
          <div className="text-right">
            <span className="text-xs text-slate-500 font-medium">
              Số lượng chứng từ: <span className="font-bold text-on-surface">{approvedTx.length}</span>
            </span>
          </div>
        </div>

        {/* Financial KPI Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200">
            <div className="text-xs font-semibold text-emerald-800">Tổng Thu Ngân Sách Quỹ</div>
            <div className="text-2xl font-bold font-numeric-data text-emerald-700 mt-1">
              {formatCurrencyVND(totalIncome)}
            </div>
            <div className="text-[11px] text-emerald-600 mt-0.5">
              {approvedTx.filter((t) => t.transactionType === 'INCOME').length} phiếu thu hợp lệ
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200">
            <div className="text-xs font-semibold text-amber-900">Tổng Chi Ngân Sách Quỹ</div>
            <div className="text-2xl font-bold font-numeric-data text-amber-800 mt-1">
              {formatCurrencyVND(totalExpense)}
            </div>
            <div className="text-[11px] text-amber-700 mt-0.5">
              {approvedTx.filter((t) => t.transactionType === 'EXPENSE').length} phiếu chi hợp lệ
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-blue-50 border border-blue-200">
            <div className="text-xs font-semibold text-blue-900">Tồn Quỹ / Thặng Dư Ròng</div>
            <div className="text-2xl font-bold font-numeric-data text-blue-800 mt-1">
              {formatCurrencyVND(balance)}
            </div>
            <div className="text-[11px] text-blue-600 mt-0.5">
              {balance >= 0 ? '✓ Đảm bảo an toàn ngân sách' : '⚠ Thâm hụt ngân sách cơ sở'}
            </div>
          </div>
        </div>

        {/* Table: Breakdown by Category/Fund */}
        <div className="overflow-x-auto border border-surface-container-high rounded-2xl">
          <table className="w-full text-xs text-left">
            <thead className="bg-surface-container-low text-on-surface-variant font-semibold border-b border-surface-container-high">
              <tr>
                <th className="py-3 px-4">Hạng mục quỹ</th>
                <th className="py-3 px-4 text-right">Tổng Thu (VNĐ)</th>
                <th className="py-3 px-4 text-right">Tổng Chi (VNĐ)</th>
                <th className="py-3 px-4 text-right">Tồn Quỹ / Chênh Lệch</th>
                <th className="py-3 px-4 text-center">Tỷ trọng chi</th>
                <th className="py-3 px-4 text-center">Số chứng từ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container-high">
              {categoryFundReports.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-on-surface-variant italic">
                    Chưa có giao dịch thu chi nào được phê duyệt trong hệ thống.
                  </td>
                </tr>
              ) : (
                categoryFundReports.map((cat) => {
                  const expensePct = totalExpense > 0 ? Math.round((cat.expense / totalExpense) * 100) : 0;
                  return (
                    <tr key={cat.categoryName} className="hover:bg-surface-container-low/50 transition-colors">
                      <td className="py-3 px-4 font-semibold text-slate-800">
                        {cat.categoryName}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-emerald-700">
                        {formatCurrencyVND(cat.income)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-amber-800">
                        {formatCurrencyVND(cat.expense)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold">
                        <span
                          className={`px-2 py-0.5 rounded-md ${
                            cat.net > 0
                              ? 'bg-emerald-100 text-emerald-800'
                              : cat.net < 0
                              ? 'bg-red-100 text-red-800'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {formatCurrencyVND(cat.net)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center font-medium text-slate-600">
                        {expensePct}%
                      </td>
                      <td className="py-3 px-4 text-center text-on-surface-variant">
                        <span className="font-semibold text-slate-800">{cat.totalCount}</span> ({cat.incomeCount} thu, {cat.expenseCount} chi)
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {categoryFundReports.length > 0 && (
              <tfoot className="bg-surface-container-low font-bold text-slate-900 border-t-2 border-surface-container-highest">
                <tr>
                  <td className="py-3 px-4">TỔNG CỘNG</td>
                  <td className="py-3 px-4 text-right font-mono text-emerald-800">
                    {formatCurrencyVND(totalIncome)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-amber-900">
                    {formatCurrencyVND(totalExpense)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono">
                    <span
                      className={`px-2 py-0.5 rounded-md ${
                        balance >= 0 ? 'bg-emerald-200 text-emerald-900' : 'bg-red-200 text-red-900'
                      }`}
                    >
                      {formatCurrencyVND(balance)}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center">100%</td>
                  <td className="py-3 px-4 text-center">{approvedTx.length}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
