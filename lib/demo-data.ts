import type { FeedPost } from "@/lib/types";

export const titanicDemoPosts: FeedPost[] = [
  {
    id: "demo-1",
    feedTime: "1912-04-14T22:50:00-03:00",
    author: "SS Californian",
    role: "Ship status",
    content:
      "Stopped for the night after encountering field ice. The wireless operator has been told to advise Titanic that Californian is stopped and surrounded by ice.",
    accuracyType: "context",
    sourceLabel: "U.S. Senate Inquiry — Stanley Lord testimony",
    sourceUrl: "https://www.titanicinquiry.org/USInq2/AmInq08Lord01.php"
  },
  {
    id: "demo-2",
    feedTime: "1912-04-14T23:25:00-03:00",
    author: "Cyril Evans",
    role: "Wireless operator • SS Californian",
    content:
      "Titanic is still working Cape Race. I am about to turn in for the night.",
    accuracyType: "reconstructed",
    sourceLabel: "U.S. Senate Inquiry — Cyril Evans testimony",
    sourceUrl: "https://www.titanicinquiry.org/USInq/AmInq08EvansCF01.php"
  },
  {
    id: "demo-3",
    feedTime: "1912-04-14T23:40:00-03:00",
    author: "RMS Titanic",
    role: "Historical event",
    content:
      "The ship strikes an iceberg in the North Atlantic. The severity of the damage is not yet understood by most people aboard.",
    accuracyType: "context",
    sourceLabel: "British Wreck Commissioner's Inquiry",
    sourceUrl: "https://www.titanicinquiry.org/BOTInq/BOTReport/botRepMessages.php"
  },
  {
    id: "demo-4",
    feedTime: "1912-04-15T00:15:00-03:00",
    author: "Titanic Wireless",
    role: "Marconi room • RMS Titanic",
    content:
      "A CQD distress call is transmitted to ships within wireless range.",
    accuracyType: "documented",
    sourceLabel: "British Inquiry — Means taken to procure assistance",
    sourceUrl: "https://www.titanicinquiry.org/BOTInq/BOTReport/botRepAssist.php"
  },
  {
    id: "demo-5",
    feedTime: "1912-04-15T00:25:00-03:00",
    author: "RMS Carpathia",
    role: "Wireless contact",
    content:
      "Carpathia receives Titanic's call reporting that the ship has struck an iceberg and needs immediate assistance.",
    accuracyType: "documented",
    sourceLabel: "British Inquiry — Means taken to procure assistance",
    sourceUrl: "https://www.titanicinquiry.org/BOTInq/BOTReport/botRepAssist.php"
  },
  {
    id: "demo-6",
    feedTime: "1912-04-15T00:26:00-03:00",
    author: "Titanic Wireless",
    role: "Marconi room • RMS Titanic",
    content:
      "The distress traffic now reports that Titanic is sinking; escaping steam is making wireless communication difficult.",
    accuracyType: "documented",
    sourceLabel: "British Inquiry — Means taken to procure assistance",
    sourceUrl: "https://www.titanicinquiry.org/BOTInq/BOTReport/botRepAssist.php"
  }
];
