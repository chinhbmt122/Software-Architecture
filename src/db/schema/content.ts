import {
  bigint,
  boolean,
  integer,
  numeric,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core"
import { chapterStatusEnum, novelStatusEnum, originalLanguageEnum } from "./enums"
import { users } from "./auth"

export const novels = pgTable("novels", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: varchar("title", { length: 500 }).notNull(),
  slug: varchar("slug", { length: 600 }).notNull().unique(),
  synopsis: text("synopsis"),
  coverImageUrl: text("cover_image_url"),
  status: novelStatusEnum("status").notNull().default("ONGOING"),
  originalLanguage: originalLanguageEnum("original_language").notNull().default("ZH"),
  isFeatured: boolean("is_featured").notNull().default(false),
  totalChapters: integer("total_chapters").notNull().default(0),
  totalViews: bigint("total_views", { mode: "number" }).notNull().default(0),
  avgRating: numeric("avg_rating", { precision: 3, scale: 2 }),
  createdBy: text("created_by")
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
})

export const chapters = pgTable(
  "chapters",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    novelId: uuid("novel_id")
      .notNull()
      .references(() => novels.id, { onDelete: "cascade" }),
    chapterNumber: integer("chapter_number").notNull(),
    title: varchar("title", { length: 500 }).notNull(),
    content: text("content").notNull().default(""),
    wordCount: integer("word_count").notNull().default(0),
    isVip: boolean("is_vip").notNull().default(false),
    coinCost: integer("coin_cost"),
    status: chapterStatusEnum("status").notNull().default("DRAFT"),
    totalViews: bigint("total_views", { mode: "number" }).notNull().default(0),
    publishedAt: timestamp("published_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("chapters_novel_chapter_idx").on(t.novelId, t.chapterNumber)],
)

export const genres = pgTable("genres", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull().unique(),
  slug: varchar("slug", { length: 120 }).notNull().unique(),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  parentId: integer("parent_id").references((): any => genres.id),
  sortOrder: integer("sort_order").notNull().default(0),
})

export const novelGenres = pgTable(
  "novel_genres",
  {
    novelId: uuid("novel_id")
      .notNull()
      .references(() => novels.id, { onDelete: "cascade" }),
    genreId: integer("genre_id")
      .notNull()
      .references(() => genres.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.novelId, t.genreId] })],
)

export const tags = pgTable("tags", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull().unique(),
  slug: varchar("slug", { length: 120 }).notNull().unique(),
})

export const novelTags = pgTable(
  "novel_tags",
  {
    novelId: uuid("novel_id")
      .notNull()
      .references(() => novels.id, { onDelete: "cascade" }),
    tagId: integer("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.novelId, t.tagId] })],
)
