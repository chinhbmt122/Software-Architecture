import {
  index,
  pgTable,
  primaryKey,
  text,
  timestamp,
  integer,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core"
import { libraryStatusEnum } from "./enums"
import { users } from "./auth"
import { chapters, novels } from "./content"

export const readingProgress = pgTable(
  "reading_progress",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    novelId: uuid("novel_id")
      .notNull()
      .references(() => novels.id, { onDelete: "cascade" }),
    chapterId: uuid("chapter_id")
      .notNull()
      .references(() => chapters.id, { onDelete: "cascade" }),
    scrollPosition: integer("scroll_position").notNull().default(0),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("rp_user_chapter_idx").on(t.userId, t.chapterId),
    index("rp_user_novel_idx").on(t.userId, t.novelId),
  ],
)

export const bookmarks = pgTable("bookmarks", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  chapterId: uuid("chapter_id")
    .notNull()
    .references(() => chapters.id, { onDelete: "cascade" }),
  position: integer("position").notNull(),
  note: text("note"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
})

export const libraryEntries = pgTable(
  "library_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    novelId: uuid("novel_id")
      .notNull()
      .references(() => novels.id, { onDelete: "cascade" }),
    status: libraryStatusEnum("status").notNull().default("READING"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("le_user_novel_idx").on(t.userId, t.novelId)],
)

export const novelFollows = pgTable(
  "novel_follows",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    novelId: uuid("novel_id")
      .notNull()
      .references(() => novels.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.novelId] })],
)

export const userFollows = pgTable(
  "user_follows",
  {
    followerId: text("follower_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    followingId: text("following_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.followerId, t.followingId] })],
)
