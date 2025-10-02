export type ReviewTemplate = {
  id: string;
  label: string;
  status: "approved" | "rejected";
  defaultNotes: string;
  notificationHint: string;
  priority: "standard" | "high";
};

export const REVIEW_TEMPLATES: ReviewTemplate[] = [
  {
    id: "missing-details",
    label: "情報不足 (再投稿依頼)",
    status: "rejected",
    defaultNotes: "イベントの開始・終了時刻や詳細情報が不足しています。必要事項を追記のうえ再申請してください。",
    notificationHint: "必要項目が不足しているため却下しました。内容を追記して再度申請してください。",
    priority: "high"
  },
  {
    id: "location-unclear",
    label: "位置情報の確認",
    status: "rejected",
    defaultNotes: "登録された位置が実際の開催場所と異なる可能性があります。地図上の位置をご確認ください。",
    notificationHint: "位置情報が不明確だったため非承認としました。地図上のピンを修正して再申請してください。",
    priority: "high"
  },
  {
    id: "policy-violation",
    label: "コンテンツポリシー違反",
    status: "rejected",
    defaultNotes: "投稿内容がコンテンツポリシーに抵触する可能性があります。内容を修正のうえ再申請してください。",
    notificationHint: "コンテンツポリシーに合致しない内容が含まれていたため却下しました。",
    priority: "high"
  },
  {
    id: "approval-default",
    label: "承認メモ (任意)",
    status: "approved",
    defaultNotes: "審査を完了しました。公開スケジュールどおりに掲載されます。",
    notificationHint: "審査が完了し公開予定どおり掲載されます。",
    priority: "standard"
  }
];
