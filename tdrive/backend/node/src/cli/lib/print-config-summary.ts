import config from "../../core/config";

export default function printConfigSummary(useIcons: boolean = !!process.env.HAVE_NERDFONT) {
  const j = (x: any) => JSON.stringify(x);
  const icons = useIcons
    ? {
        // Uses NerdFonts https://www.nerdfonts.com/cheat-sheet - set HAVE_NERDFONT to truthy to activate them
        host: "\udb82\ude60",
        user: "\uf007",
        bucket: "\udb85\udc16",
        keyspace: "\udb84\udcec",
        datacenter: "\udb81\udc8d",
        path: "\uea83",
        // Sections:
        storage: "\udb80\ude59",
        database: "\uf1c0",
        search: "\udb82\udd56",
        "message-queue": "\udb83\udd89",
      }
    : {};
  const sectionTemplates = {
    local: conf => (conf ? ["path", conf.path] : []), // local clashes between storage and message-queue
    amqp: ({ urls }) => ["host", urls],
    postgres: ({ host, port, database, user }) => [
      "host",
      [host, port],
      "database",
      database,
      "user",
      user,
    ],
    S3: ({ endPoint, port, accessKey, bucket }) => [
      "host",
      [endPoint, port],
      "bucket",
      bucket,
      "user",
      accessKey,
    ],
    mongodb: (mongoConf, _, section) => {
      // The search driver may also be mongodb, but the database config is what's used
      if (section === "search") {
        if (config.get("database.type") === "mongodb")
          return ["database", "Same mongodb as database"];
        mongoConf ||= config.get("database.mongodb");
      }
      return ["host", mongoConf.uri, "database", mongoConf.database];
    },
    elasticsearch: ({ endpoint }) => ["host", endpoint],
    opensearch: conf => sectionTemplates.elasticsearch(conf),
  };
  const sectionTitleAliases: { [key: string]: string } = {
    postgres: "pg",
    elasticsearch: "ES",
    opensearch: "OS",
    mongodb: "mongo",
  };
  if (useIcons) {
    const makeLyingLengthIcon = str => ({ length: 1, toString: _ => str } as string);
    sectionTitleAliases.postgres = makeLyingLengthIcon("\ue76e");
    sectionTitleAliases.amqp = makeLyingLengthIcon("\udb86\ude61");
    sectionTitleAliases.mongodb = makeLyingLengthIcon("\ue7a4");
  }
  const sections = "database storage search message-queue".split(" ");
  const sectionTitleAlias = x => sectionTitleAliases[x] || x;
  const asIcon = x => icons[x] || x + ":";
  const repeatStr = (len: number, str = " ") => (len < 1 ? "" : new Array(len + 1).join(str));
  const leftPad = (s: string, minLen: number, spacer = " ") =>
    repeatStr(minLen - s.length, spacer) + s;
  const rightPad = (s: string, minLen: number, spacer = " ") =>
    s + repeatStr(minLen - s.length, spacer);
  const sectionWidth = sections.reduce(
    (a, b) => Math.max(a, icons[b] ? 1 : b.length + ":".length),
    0,
  );
  const makeSectionTemplate = (type, conf, sectionName) =>
    sectionTemplates[type]
      ? sectionTemplates[type](conf[type], conf, sectionName)
          .map((x, i) => (i % 2 ? j(x) : asIcon(x)))
          .join(" ")
      : conf[type]
      ? j(conf[type])
      : `WARNING invalid ${sectionName} type ${j(type)} !`;
  const sectionTypeWidth = sections.reduce(
    (a, b) => Math.max(a, sectionTitleAlias((config.get(b) as { type: string }).type).length),
    0,
  );
  const configType = (conf: any, sectionName: string) => {
    const section = makeSectionTemplate(conf.type, conf, sectionName);
    return `${leftPad(sectionTitleAlias(conf.type), sectionTypeWidth)}${
      section.length ? ": " + section : ""
    }`;
  };
  return sections.map(
    x =>
      `${
        icons[x] ? repeatStr(sectionWidth - 1) + icons[x] : rightPad(x + ":", sectionWidth)
      } ${configType(config.get(x), x)}`,
  );
}
