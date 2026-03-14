const { MongoClient, ObjectId } = require("mongodb");
const uri = "mongodb+srv://luxenlabs:0uG0wGgikK1a5I7L@cluster0.1nrv2.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
async function run() {
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db("hive");
  const tasks = await db.collection("tasks").find({}).toArray();
  console.log("Tasks in DB:", tasks.length);
  if (tasks.length > 0) {
    console.log("Sample task ID:", tasks[0]._id.toString());
    const single = await db.collection("tasks").findOne({ _id: new ObjectId(tasks[0]._id.toString()) });
    console.log("Found single:", !!single);
  }
  process.exit(0);
}
run();
