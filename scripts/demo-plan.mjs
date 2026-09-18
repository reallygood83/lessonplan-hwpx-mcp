export const DEMO_PLAN = {
  title: "한 기관에 모든 힘을 주지 않는 이유, 삼권분립의 지혜 탐구하기",
  questionizedObjectives: ["삼권분립이 왜 필요한지 질문으로 탐구한다"],
  drivingQuestion:
    "왜 민주 국가에서는 한 사람이 아니라 세 기관이 힘을 나누어 가질까요?",
  inquiryQuestions: [
    "만약 권력이 한곳에 집중되면 어떤 문제가 생길까요?",
    "국회, 행정부, 법원은 각각 어떤 역할을 할까요?",
  ],
  stages: [
    {
      stage: "도입",
      minutes: 5,
      leadQuestion: "권력이 한곳에 모이면?",
      activities: [
        {
          name: "권력 집중 상황 체험하기",
          teacher:
            "만약 우리 반 반장이 혼자서 규칙도 만들고, 지켰는지 검사하고, 벌까지 준다면 어떤 일이 생길까요?",
          student:
            "학급 비유 상황을 듣고 권력 집중의 위험성을 생각해 의견을 나눈다.",
          note: "학급 비유 상황 제시",
        },
      ],
    },
    {
      stage: "전개",
      minutes: 30,
      leadQuestion: "세 기관은 어떻게 역할을 나누나?",
      activities: [
        {
          name: "국가기관 역할 분담 모둠 탐구",
          teacher: "역할 카드를 세 기관에 맞게 분류해 봅시다.",
          student: "모둠별로 카드를 분류하고 핵심 역할을 탐구한다.",
          note: "역할 카드 제공",
        },
      ],
    },
    {
      stage: "정리",
      minutes: 5,
      leadQuestion: "누구의 권리를 지키나?",
      activities: [
        {
          name: "성찰 일지",
          teacher: "한 문장으로 답을 적어 볼까요?",
          student: "성찰 일지를 작성한다.",
        },
      ],
    },
  ],
  assessment: [
    { criteria: "세 기관의 역할을 구분하여 설명한다", method: "관찰 평가" },
  ],
  teacherNotes: ["법률 용어는 직관적 의미 중심으로 설명한다."],
  standards: [],
};

export const DEMO_CURRICULUM = {
  schoolLevel: "elementary",
  subject: "사회",
  gradeBandId: "elem-5-6",
  standardRefs: [],
};
