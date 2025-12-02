# Vocalytics Financial Model - Excel/Sheets Setup Guide

## Quick Start

1. **Open the CSV**: Import `vocalytics-financial-model.csv` into Excel or Google Sheets
2. **Make it interactive**: Follow formulas below to add calculations
3. **Customize**: Change the input values (in yellow) to model your scenarios

---

## Key Formulas to Add

### Unit Economics Section

**Cell B7** (Contribution Margin per User):
```excel
=B4-B9
```

**Cell B8** (Margin %):
```excel
=B7/B4
```

**Cell B14** (Stripe Fee):
```excel
=(B4*0.029)+0.30
```

**Cell B16** (Total Variable Cost):
```excel
=SUM(B13:B15)
```

---

### Customer Acquisition Section

**Cell B22** (Payback Period in months):
```excel
=B21/B7
```

**Cell B23** (LTV:CAC Ratio):
```excel
=(B7*B24)/B21
```

**Cell B29** (Free-to-Paid Conversion %):
```excel
=B30/B28*100
```

---

### Growth Projections Table

Assuming columns: B=Month 1, C=Month 2, D=Month 3, E=Month 6, F=Month 12, G=Month 24

**Row: Free Users (cumulative)**
- Cell C: `=B+C_new_users` (previous + new)

**Row: Pro Users (cumulative)**
- Cell C: `=B+C_new_pro_users`

**Row: Conversion Rate**
- Cell B: `=B_pro_users/B_free_users`

**Row: Monthly Recurring Revenue**
- Cell B: `=B_pro_users*$B$4` (Pro users × $9.99)

**Row: Variable Costs**
- Cell B: `=B_pro_users*$B$16` (Pro users × total variable cost)

**Row: Contribution Margin**
- Cell B: `=B_MRR-B_variable_costs`

**Row: Operating Profit/Loss**
- Cell B: `=B_contribution_margin-$B$36` (Contribution - Fixed Costs)

**Row: Cumulative Cash Flow**
- Cell C: `=B_cumulative+C_operating_profit`

---

### Break-Even Analysis

**Cell B48** (Break-even Pro Subscribers):
```excel
=B46/B47
```
Where B46 = Monthly Fixed Costs, B47 = Contribution Margin per User

**Cell B49** (Break-even MRR):
```excel
=B48*$B$4
```

**Cell B51** (Total Users Needed at 10% conversion):
```excel
=B48/0.10
```

---

### Pricing Sensitivity Table

Assuming Column A = Price Point, Column B = MRR, etc.

**Column C** (Contribution Margin at different prices):
```excel
=A2-$B$16
```
Where A2 is the price point, $B$16 is total variable cost (fixed)

**Column D** (Margin %):
```excel
=C2/A2
```

**Column E** (Breakeven Users):
```excel
=$B$46/C2
```
Where $B$46 is monthly fixed costs

---

## Scenario Planning Formulas

**Conservative/Base/Optimistic MRR** (row for Month 6):
```excel
=Pro_Users*$B$4
```

**Operating Profit**:
```excel
=(Pro_Users*$B$7)-$B$46
```
Where $B$7 is contribution margin per user, $B$46 is fixed costs

---

## Setting Up in Google Sheets

### Step 1: Import CSV
1. Open Google Sheets
2. File → Import → Upload → Select `vocalytics-financial-model.csv`
3. Import location: "Replace spreadsheet"
4. Separator type: "Comma"

### Step 2: Add Color Coding
- **Yellow cells** = Inputs (you change these)
  - Monthly subscription price
  - Variable costs
  - Target CAC
  - Growth assumptions (new users per month)
  - Conversion rates

- **Blue cells** = Formulas (auto-calculated)
  - All margin calculations
  - MRR projections
  - Break-even analysis
  - Cumulative cash flow

### Step 3: Add Data Validation
For conversion rate cells, add dropdown:
- Data → Data validation
- Criteria: List of items: `5%, 8%, 10%, 12%, 15%, 20%`

---

## Key Scenarios to Model

### 1. Pricing Test
**Question:** What if we charge $14.99 instead of $9.99?

**Change:**
- Cell B4 (price) to `14.99`
- Cell B29 (conversion) to `8%` (higher price = lower conversion)

**Watch:** Break-even subscribers, Month 12 MRR

---

### 2. Higher CAC (Paid Ads)
**Question:** What if we spend on Facebook ads at $50 CAC?

**Change:**
- Cell B21 (CAC) to `50`

**Watch:** Payback period (should be <6 months), LTV:CAC ratio (should stay >3)

---

### 3. Viral Growth
**Question:** What if we get featured on Product Hunt?

**Change:**
- Month 2 new free users to `1000`
- Month 3 new free users to `500`
- Conversion rate to `12%` (higher intent users)

**Watch:** Month 3 cash flow, infrastructure scaling needs

---

### 4. Enterprise Pivot
**Question:** What if we add $49/month team plan?

**Add row:**
- Enterprise Users: 20% of Pro users
- Enterprise MRR: `=Enterprise_Users*49`
- Total MRR: `=Pro_MRR+Enterprise_MRR`

---

## Advanced: Create Charts

### Chart 1: Revenue Growth
- **Type:** Line chart
- **X-axis:** Months (1, 2, 3, 6, 12, 24)
- **Y-axis:** MRR
- **Series 2:** Operating Profit (different color)

### Chart 2: User Growth
- **Type:** Stacked column chart
- **X-axis:** Months
- **Series 1:** Free Users (bottom)
- **Series 2:** Pro Users (top, different color)

### Chart 3: Break-even Visualization
- **Type:** Horizontal bar chart
- **Categories:** Conservative, Base, Optimistic
- **Values:** Months to break-even

---

## Downloadable Template

**Want a pre-built Google Sheets template?**

1. Copy this link structure: `https://docs.google.com/spreadsheets/d/your-sheet-id/copy`
2. Or manually create from CSV and save as template
3. Share link in team Slack/docs

---

## Validation Checklist

After setting up your model, verify:

- [ ] MRR in Month 12 matches: Pro Users × $9.99
- [ ] Contribution margin is 70-75% (healthy SaaS)
- [ ] Break-even is <20 Pro users (achievable in 2-3 months)
- [ ] Payback period is <6 months (investor-friendly)
- [ ] LTV:CAC ratio is >3 (sustainable growth)
- [ ] Cumulative cash flow turns positive by Month 3

---

## Common Mistakes to Avoid

1. **Forgetting Stripe fees** - Always include 2.9% + $0.30 in variable costs
2. **Overestimating conversion** - 10% is optimistic for freemium, 5-8% is safer
3. **Underestimating OpenAI costs** - Heavy users can cost $2-3/month in API calls
4. **Ignoring churn** - Assumes 0% monthly churn (add 3-5% for realism)
5. **Linear growth** - Real growth is lumpy (Product Hunt spike, then plateau)

---

## Next Steps

1. **Set up the spreadsheet** with formulas above
2. **Run base case** scenario (current assumptions)
3. **Test 3 scenarios**: Conservative, Optimistic, Pivot to Enterprise
4. **Share with team** to align on assumptions
5. **Update monthly** with actual data as you launch

---

**Questions?** See `business-model-canvas-short.md` for strategic context.

**Last Updated:** November 21, 2025
