export interface SampleDoc {
  id: string;
  title: string;
  type: 'pdf' | 'docx' | 'text';
  category: '學術論文' | '商業報告' | '考試複習' | '科技趨勢';
  description: string;
  content: string;
}

export const SAMPLE_DOCS: SampleDoc[] = [
  {
    id: 'sample_ai_agent',
    title: '自主 AI Agent 技術演進與實務應用展望',
    type: 'text',
    category: '科技趨勢',
    description: '深度分析從大型語言模型 (LLM) 邁向具備工具調用、自主規劃與記憶機制的 AI Agent 發展趨勢。',
    content: `自主 AI Agent 技術演進與實務應用展望

【摘要】
隨著生成式人工智慧（Generative AI）技術快速發展，AI 系統正逐漸從單純的「問答對話」轉型為具備自主目標規劃、環境感知、工具使用（Tool Use）以及長短期記憶（Memory）能力的「自主 AI Agent」（Autonomous AI Agent）。本文探討 Agent 的核心架構、關鍵能力要素、當前技術瓶頸以及未來在企業自動化、個人助理與科學研究中的落地前景。

一、 AI Agent 核心架構四大支柱
1. 大規模語言模型大腦（LLM Core Engine）：
作為 Agent 的推理與感知中樞，負責語意理解、邏輯分解與決策生成。模型之上下文長度（Context Window）與邏輯思考（Reasoning Chain）品質直接決定 Agent 的處理上限。

2. 規劃與任務拆解（Planning & Reflection）：
- 思維鏈（Chain-of-Thought, CoT）與樹狀思考（Tree-of-Thoughts, ToT）：將複雜任務拆解為可執行的子步驟。
- 反思與自我修正（Self-Reflection / Reflexion）：Agent 能夠評估執行結果，若遇到錯誤自動修正策略，確保目標順利達成。

3. 記憶機制（Memory System）：
- 短期記憶（Short-Term Memory）：基於 Context Window 的對話上下文與當前任務狀態。
- 長期記憶（Long-Term Memory）：結合向量資料庫（Vector DB / RAG）與外部資料存取，實現跨會話的知識積累與經驗學習。

4. 工具與 API 調用（Tools & Execution Environment）：
允許 Agent 超越文字生成範疇，直接發送 HTTP RPC 請求、執行 Python 代碼、查詢資料庫、操作瀏覽器或調用雲端服務。

二、 實務應用場景
1. 軟體開發自動化：如 AI 程式設計助理，能自動閱讀 Git Repository，撰寫單元測試、修復 Bug 並提交 Pull Request。
2. 企業知識庫問答與自動化流程：自動檢索合約文件、生成財報分析報告並傳送通知至 Slack/Teams。
3. 個人化多模態超級助理：協助使用者預訂行程、整理郵件、歸納重點並生成個人行事曆。

三、 挑戰與未來展望
目前 Agent 發展面臨的主要挑戰包括：
- 幻覺與連鎖出錯（Cascading Errors）：早期步驟的偏差可能導致後續操作嚴重脫軌。
- 權限管理與資安（Security & Governance）：代理人獲取系統 API 權限後，可能面臨 Prompt Injection 攻擊或未授權的操作風險。
- 運算成本與延遲：多輪推理與工具互動需要多次 LLM 呼叫，導致回應時間拉長。

【結論】
AI Agent 代表了人工智慧技術從「輔助生成」走向「自主執行」的歷史性跳躍。企業與開發者應著重建立安全的運作邊界與靈活的 Agent 架構，以迎接到來的自動化新時代。`,
  },
  {
    id: 'sample_business_report',
    title: '2026 年全球企業數位轉型與 AI 落地策略報告',
    type: 'docx',
    category: '商業報告',
    description: '針對跨國企業在導入 AI 驅動自動化、數據治理與客戶體驗升級的實務分析與投資回報率 (ROI) 評估。',
    content: `2026 全球企業數位轉型與 AI 落地策略報告

執行摘要 (Executive Summary)
本報告調查全球 500 強企業在 2025-2026 年間推動數位轉型與人工智慧（AI）應用的具體成果。調查顯示，超過 78% 的企業已將生成式 AI 列為核心戰略投資重點。然而，僅有 32% 的企業成功實現規模化 ROI（投資報酬率）。關鍵差異在於「數據治理結構」、「跨部門流程重構」以及「員工 AI 賦能訓練」。

第一章：企業 AI 導入的三大戰略階段
1. 實驗與試點期 (Exploration Stage)：
專注於零碎的個人生產力工具，如 Copilot、自動會議紀錄。此階段資本投入較低，但對企業整體營收影響有限。

2. 流程整合與自動化期 (Integration Stage)：
將 AI 嵌入核心業務流程，如客服自動分流、供應鏈預測、智慧財務報帳。投資回報率開始在營運成本削減（OpEx Reduction）中顯現。

3. 商業模式創新期 (Transformation Stage)：
以 AI 驅動全新產品與服務，例如訂閱制 AI 顧問服務、數據資產變現。頂尖領先企業於此階段創造平均 18% 的營收成長。

第二章：主要挑戰與風險指標
- 數據孤島與品質不佳 (45%)：企業內部數據缺乏標準化，導致 AI 訓練與 RAG 檢索效果欠佳。
- 組織抗拒與人才缺口 (38%)：員工缺乏對 AI 工具的使用信心，基層主管擔心職務被替代。
- 隱私合規與資安威脅 (29%)：歐盟 AI Act 等全球法規趨嚴，資料外洩與著作權爭議成為合規防線考驗。

第三章：成功引導企業 AI 落地之五大建議
1. 建立 C-Level 專責 AI 委員會：由 CTO/CIO 領軍，結合法務與業務主管共同制定 AI 使用規範。
2. 投資高品質企業數據湖 (Enterprise Data Lake)：清理非結構化數據（PDF、Word、郵件），打造支援 RAG 的知識基礎設施。
3. 採用「Human-in-the-Loop」人機協同機制：關鍵業務決策仍需人工審核，確保品質與責任歸屬。
4. 提供全員 Prompt 與 AI 素養培訓：將 AI 應用能力納入年度績效評估指標。
5. 建立敏捷指標 (KPIs & OKRs)：不只看短期成本降低，更看客戶滿意度 (NPS) 與創新流程突破時間。`,
  },
  {
    id: 'sample_psychology_exam',
    title: '認知心理學：記憶系統與學習效率考點總整理',
    type: 'pdf',
    category: '考試複習',
    description: '心理學系重點考試精華，涵蓋感官記憶、工作記憶、長期記憶分類與記憶編碼與提取策略。',
    content: `認知心理學重點考點總整理：記憶系統與學習策略

第一節：記憶的三階段模型 (Atkinson-Shiffrin Model)
1. 感官記憶 (Sensory Memory)：
- 視覺感官記憶 (Iconic Memory)：持續約 0.5 秒。
- 聽覺感官記憶 (Echoic Memory)：持續約 3-4 秒。
- 特性：容量極大，但衰退極快，未獲注意力關注的資訊將立即消失。

2. 短期與工作記憶 (Short-Term & Working Memory)：
- 容量限度：經典 George Miller 的 7±2 個意群 (Chunks)，近期研究修正為約 4 個單位。
- 持續時間：若無複誦（Rehearsal），約維持 15-30 秒。
- 巴德利工作記憶模型 (Baddeley's Working Memory Model)：
  * 中央執行系統 (Central Executive)：注意力的分配與控制。
  * 語音迴路 (Phonological Loop)：處理語言與聲音資訊。
  * 視覺空間繪圖板 (Visuospatial Sketchpad)：處理心像與空間資訊。
  * 情節緩衝區 (Episodic Buffer)：整合跨模態資訊，連接長期記憶。

3. 長期記憶 (Long-Term Memory)：
- 陳述性記憶 / 外顯記憶 (Declarative / Explicit Memory)：
  * 情節記憶 (Episodic Memory)：個人親身經歷與時間事件。
  * 語義記憶 (Semantic Memory)：一般性事實知識與概念。
- 非陳述性記憶 / 內隱記憶 (Non-declarative / Implicit Memory)：
  * 程序性記憶 (Procedural Memory)：技能與動作（如騎腳踏車、打字）。
  * 古典制約與引發效應 (Priming)。

第二節：提升記憶與學習效率的關鍵機制
1. 精細複誦 (Elaborative Rehearsal) vs. 維持性複誦 (Maintenance Rehearsal)：
單純死記硬背（維持性複誦）效果極差；將新知識與既有知識建構意義連結（精細複誦）才能有效存入長期記憶。

2. 加工深度理論 (Levels of Processing Theory - Craik & Lockhart)：
- 淺層加工（物理特徵，如字體大小）-> 記憶效果差。
- 中層加工（語音特徵，如押韻）-> 記憶效果中等。
- 深層加工（語意理解、自我參照 Self-Reference Effect）-> 記憶效果最強！

3. 間隔重複與提問測試 (Spaced Repetition & Retrieval Practice)：
- 遺忘曲線 (Ebbinghaus Forgetting Curve)：學習後 24 小時內遺忘最快。
- 主動提取（Active Recall）：比起反覆閱讀，主動自我測驗能激發神經塑性，大幅提升長期留存率。`,
  },
];
