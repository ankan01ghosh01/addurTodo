import express from 'express';
import pg from 'pg';
import path from 'path';
import { fileURLToPath } from 'url';
import session from 'express-session';
import bcrypt from 'bcrypt';
import { nanoid } from "nanoid";
import dotenv from "dotenv";
import pgSession from "connect-pg-simple";


dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Get the full Day Name (e.g., Monday)
const today = new Date();
const dayName = today.toLocaleString('en-US', { weekday: 'long' });
const monthName = today.toLocaleString('en-US', { month: 'long' });
const date = today.getDate();
const year = today.getFullYear();

// database Connect
const db = new pg.Client({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false,
    },
});

db.connect();

// Middleware used ......
app.use(express.urlencoded({extended: true}));
app.set("views", path.join(__dirname, "views"));
app.use(express.static("public"));
app.use(express.static(path.join(__dirname, "public")));
app.set("view engine", "ejs");
// session
// ✅ SESSION FIX (IMPORTANT PART)
const PgStore = pgSession(session);

app.use(session({
    store: new PgStore({
        conString: process.env.DATABASE_URL,
        tableName: "session" // auto-created
    }),
    secret: process.env.SESSION_SECRET || "strong_secret_key_here",
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 1000 * 60 * 60 * 24 * 3, // ✅ 3 DAYS LOGIN
        httpOnly: true,                 // ✅ security
        secure: false                   // ⚠️ set true in production (HTTPS)
    }
}));

app.use((req, res, next) => {
    res.locals.users = req.session.users || null;
    next();
});


// functions 
async function hashPassword(password) {
    const hashedPassword = await bcrypt.hash(password, 10);
    return hashedPassword;
};

async function verifyPassword(enterPassword, storeHashPass) {
    const isPassMatch = await bcrypt.compare(enterPassword, storeHashPass);
    return isPassMatch;
}

function isAuthenticated(req, res, next) {
    if(req.session.users) return next();
    res.redirect("/log-inPage");
}

async function getUser_task(userID, filter = "all") {
    try {
        let query = `SELECT * FROM tasks WHERE user_id = $1`;
        let values = [userID];
        if (filter === "active") {
            query += ` AND task_status = false`;
        } else if (filter === "completed") {
            query += ` AND task_status = true`;
        }
        query += ` ORDER BY created_at DESC`;
        const result = await db.query(query, values);
        return result.rows;

    } catch (error) {
        console.log(error);
        throw error;
    }

}


async function getTaskCounts(userId) {
    const result = await db.query(
        `SELECT 
            COUNT(*) AS total,
            COUNT(*) FILTER (WHERE task_status = false) AS active,
            COUNT(*) FILTER (WHERE task_status = true) AS completed
            FROM tasks
            WHERE user_id = $1`,
        [userId]
    );

    return result.rows[0];
}


async function getDueNotifications(userId) {
    const result = await db.query(
        `SELECT id, task, created_at
        FROM tasks
        WHERE user_id = $1
        AND task_status = false
        AND EXTRACT(EPOCH FROM (NOW() - created_at)) >= 3600`,
        [userId]
    );

    return result.rows;
}

// Middleware: Check Role
async function getUserRole(userId, teamId) {
    const result = await db.query(
        `SELECT role FROM team_members 
        WHERE user_id = $1 AND team_id = $2`,
        [userId, teamId]
    );
    return result.rows[0]?.role;
}

// routes ..................................
app.get("/", (req, res) => {
    res.render("index.ejs", {
        active : null
    });
});

app.get("/addtodo", isAuthenticated, async (req, res) => {
    try {
        let userID = req.session.users.id;
        const filter = req.query.filter || "all";

        let tasksData = await getUser_task(userID, filter);
        let taskCount = await getTaskCounts(userID);
        res.render("todolist", {
            active: "addtodo",
            date: date,
            month : monthName,
            year: year,
            dayName: dayName,
            tasks : tasksData,
            filter,
            taskCount
        });
        
    } catch (error) {
        console.error(error);
        res.status(500).send("Error loading tasks");
    }
});

app.get("/team", isAuthenticated, async (req, res) => {
    const userId = req.session.users.id;
    const teamId = 1; // temp (later dynamic)

    try {
        // get role
        const roleResult = await db.query(
            `SELECT role FROM team_members 
            WHERE user_id = $1 AND team_id = $2`,
            [userId, teamId]
        );

        const role = roleResult.rows[0]?.role || "member";

        // tasks
        const tasks = await db.query(
            `SELECT * FROM team_tasks WHERE team_id = $1`,
            [teamId]
        );

        // notifications
        const notifications = await db.query(
            `SELECT * FROM notifications 
            WHERE team_id = $1 
            ORDER BY created_at DESC LIMIT 5`,
            [teamId]
        );

        res.render("team-task.ejs", {
            active: "team",
            role,                         // ✅ FIX
            tasks: tasks.rows,
            notifications: notifications.rows,
            teamId
        });

    } catch (error) {
        console.error(error);
        res.status(500).send("Error loading team page");
    }
});

app.get("/log-inPage", (req, res) => {
    res.render("login");
});

app.get("/sing-upPage", (req, res) => {
    res.render("singup");
});

// sing up form 

app.post("/signup", async (req, res) => {
    const { fullName, email, password, password_confirm } = req.body;

    if (password !== password_confirm) {
        return res.render("singup", {
            errorMsg: "Passwords do not match"
        });
    }

    const userID = nanoid(14);

    try {
        const hashedPassword = await hashPassword(password);

        await db.query(
            `INSERT INTO newusers (user_id, full_name, user_email, password_hash)
            VALUES ($1, $2, $3, $4)`,
            [userID, fullName, email, hashedPassword]
        );

        req.session.users = {
            id: userID,
            fullName,
            email
        };

        res.redirect("/addtodo");

    } catch (error) {
        // 🔥 HANDLE DUPLICATE EMAIL
        if (error.code === "23505") {
            return res.render("singup", {
                errorMsg: "This email already has an account"
            });
        }

        console.log(error);
        res.render("singup", {
            errorMsg: "Something went wrong. Try again."
        });
    }
});

app.post("/login", async (req, res) => {
    const {email, password} = req.body;

    try {
        let login = await db.query(`
            SELECT * FROM newusers WHERE user_email ILIKE $1
        `,
        [email]
        );
        let data = login.rows[0];
        if (login.rows.length === 0) {
            return res.render("login", {
                errorMsg: "* User doesn't exist"
            });
        };
        const isMatch = await verifyPassword(password, data.password_hash);

        if (!isMatch) {
            return res.render("login", {
                errorMsg: "* password is wrong"
            });
        };

        req.session.users = {
            id: data.user_id,
            fullName: data.full_name,
            email: data.user_email
        }

        res.redirect("/addtodo");

    } catch (error) {
        console.log(error);
        res.redirect("/log-inPage");
    }
});

app.get("/logout", (req, res) => {
    req.session.destroy(() => {
        res.redirect("/");
    });
});

app.post("/addYour-todo", isAuthenticated, async (req, res) => {
    const {your_task} = req.body;
    try {
        let userID = req.session.users.id;
        let task = db.query(` INSERT INTO tasks (user_id, task, task_status)
            VALUES ($1, $2, $3)`, 
        [userID, your_task, false]
        );
        res.redirect("/addtodo");

    } catch (error) {
        res.status(500).send("Unable to add this task.")
    }
});

app.post("/update-task/:id", isAuthenticated, async (req, res) => {
    const taskId = req.params.id;
    const userId = req.session.users.id;

    await db.query(
        `UPDATE tasks 
        SET task_status = NOT task_status 
        WHERE id = $1 AND user_id = $2`,
        [taskId, userId]
    );

    res.redirect("/addtodo");
});

app.post("/delete-task/:id", isAuthenticated, async (req, res) => {
    const taskId = req.params.id;
    const userId = req.session.users.id;

    await db.query(
        `DELETE FROM tasks 
        WHERE id = $1 AND user_id = $2`,
        [taskId, userId]
    );

    res.redirect("/addtodo");
});


app.get("/notifications", isAuthenticated, async (req, res) => {
    const userId = req.session.users.id;
    const notifications = await getDueNotifications(userId);
    res.json(notifications);
});

// for all the teams ........
// Get Team Tasks
app.get("/team/:teamId", isAuthenticated, async (req, res) => {
    const userId = req.session.users.id;
    const teamId = req.params.teamId;

    const tasks = await db.query(
        `SELECT * FROM team_tasks WHERE team_id = $1 ORDER BY created_at DESC`,
        [teamId]
    );

    const role = await getUserRole(userId, teamId);

    const notifications = await db.query(
        `SELECT * FROM notifications WHERE team_id = $1 ORDER BY created_at DESC LIMIT 5`,
        [teamId]
    );

    res.render("team-task.ejs", {
        tasks: tasks.rows,
        role,
        teamId,
        notifications: notifications.rows
    });
});

// Add Task (Admin Only)
app.post("/team/:teamId/add", isAuthenticated, async (req, res) => {
    const { task } = req.body;
    const userId = req.session.users.id;
    const teamId = req.params.teamId;

    const role = await getUserRole(userId, teamId);
    if (role !== "admin") return res.send("Not allowed");

    await db.query(
        `INSERT INTO team_tasks (team_id, task, created_by)
        VALUES ($1, $2, $3)`,
        [teamId, task, userId]
    );

    await db.query(
        `INSERT INTO notifications (team_id, message)
        VALUES ($1, $2)`,
        [teamId, `New task added: ${task}`]
    );

    res.redirect(`/team/${teamId}`);
});

// Complete Task
app.post("/team/:teamId/complete/:taskId", isAuthenticated, async (req, res) => {
    const userId = req.session.users.id;
    const { teamId, taskId } = req.params;

    const role = await getUserRole(userId, teamId);

    if (!role) return res.send("Not part of team");

    await db.query(
        `UPDATE team_tasks 
        SET is_completed = NOT is_completed 
        WHERE id = $1 AND team_id = $2`,
        [taskId, teamId]
    );

    await db.query(
        `INSERT INTO notifications (team_id, message)
        VALUES ($1, $2)`,
        [teamId, `Task toggled by user ${userId}`]
    );

    res.redirect(`/team/${teamId}`);
});


app.post("/team/:teamId/notifications/clear", isAuthenticated, async (req, res) => {
    const userId = req.session.users.id;
    const { teamId } = req.params;

    const role = await getUserRole(userId, teamId);

    // ❌ Not in team
    if (!role) return res.status(403).send("Not part of team");

    // 👉 OPTIONAL: restrict to admin only
    // if (role !== "admin") return res.status(403).send("Only admin can clear");

    await db.query(
        `DELETE FROM notifications WHERE team_id = $1`,
        [teamId]
    );

    res.redirect(`/team/${teamId}`);
});



app.listen(PORT, () => {
    console.log(`server is running:${PORT}`);
});