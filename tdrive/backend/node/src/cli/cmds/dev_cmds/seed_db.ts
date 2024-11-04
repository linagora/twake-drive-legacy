import * as mongo from "mongodb";
import { v4 as uuidv4 } from "uuid";
import yargs from "yargs";
import tdrive from "../../../tdrive";
import gr from "../../../services/global-resolver";
import { getInstance } from "../../../services/user/entities/user";
import { getInstance as getCompanyInstance } from "../../../services/user/entities/company";
import PasswordEncoder from "../../../utils/password-encoder";
import { getDefaultDriveItem } from "../../../services/documents/utils";

type CLIArgs = {
  start: number;
};

const services = [
  "auth",
  "storage",
  "user",
  "files",
  "counter",
  "cron",
  "message-queue",
  "push",
  "search",
  "tracker",
  "email-pusher",
  "workspaces",
  "console",
  "applications",
  "database",
  "webserver",
];
const createTree = async (
  depth: number,
  folderData: any,
  parent: string,
  context: any,
  client: mongo.MongoClient,
) => {
  // Create an array to hold promises
  const createFolderPromises = [];

  // Loop from 0 to depth
  for (let i = 0; i < depth; i++) {
    // Modify folder data for each iteration
    folderData.name = `folder_${i}`;
    folderData.parent_id = parent; // All siblings share the same parent
    folderData.id = uuidv4();

    // Push the folder creation promise to the array
    // createFolderPromises.push(
    //   gr.services.documents.documents.create(
    //     null,
    //     folderData,
    //     {},
    //     {
    //       ...context,
    //       user: {
    //         ...context.user,
    //         server_request: false,
    //       },
    //     },
    //   ),
    // );
    // createFolderPromises.push(documentRepo.save(getDefaultDriveItem(folderData, context)));
    createFolderPromises.push(getDefaultDriveItem(folderData, context));
  }
  /// const createdFolders = await documentRepo.saveAll(createFolderPromises);
  await client.db("tdrive").collection("drive_files").insertMany(createFolderPromises);

  // Wait for all folder creation promises to resolve in parallel
  // const createdFolders = await Promise.all(createFolderPromises);

  // Optionally, return the created folders
  // return createdFolders;
};

const command: yargs.CommandModule<unknown, CLIArgs> = {
  command: "seed",
  describe: "Seed the db",
  builder: {
    start: {
      default: 0,
      type: "number",
      description: "Start start for the users",
    },
    output: {
      default: "",
      type: "string",
      description: "Folder containing the exported data",
    },
  },
  handler: async argv => {
    console.log("🌱 Seeding the database with start: ", argv.start);
    const usersNumber = 1000;
    const defaultPassword = "password";
    const userRole = "admin";
    const folderTreeDepth = 1000;

    const platform = await tdrive.run(services);
    await gr.doInit(platform);

    const client = (await gr.database.getConnector()).getClient();

    // Manage the default company
    const companies = await gr.services.companies.getCompanies();
    let company = companies.getEntities()?.[0];
    if (!company) {
      const newCompany = getCompanyInstance({
        name: "Tdrive",
        plan: { name: "Local", limits: undefined, features: undefined },
      });
      company = await gr.services.companies.createCompany(newCompany);
    }

    console.log("✅ Company created: ", company.id);

    // encoding the user password
    const passwordEncoder = new PasswordEncoder();
    const encodedPassword = await passwordEncoder.encodePassword(defaultPassword);
    // Step 1: Generate 10k users
    const usersData = Array.from({ length: usersNumber }, (_, i) => {
      const userNumber = i + argv.start * 1000;
      return {
        first_name: `User ${userNumber}`,
        last_name: `Lastname ${userNumber}`,
        username_canonical: `user${userNumber}`,
        email_canonical: `user${userNumber}@example.com`,
        password: encodedPassword,
        cache: {
          companies: [],
        },
      };
    });

    // for each user, get the user and add it to allUsers
    const allUsers = [];
    for (const userData of usersData) {
      const newUser = getInstance(userData);
      const user = await gr.services.users.create(newUser);
      allUsers.push(user.entity);
    }
    console.log("✅ Users created:: ", allUsers);

    // // for each user, assign a role
    for (const user of allUsers) {
      console.log("User is:: ", user);
      // Update user company
      await gr.services.companies.setUserRole(company.id, user.id, userRole);
      await gr.services.workspaces.processPendingUser(user);
    }
    console.log("✅ Users created");

    const updateBegin = Date.now();
    for (const user of allUsers) {
      const context = { company, user };
      const parentDrive = `user_${user.id}`;
      const folderData = await getDefaultDriveItem(
        {
          parent_id: parentDrive,
          company_id: company.id,
          is_directory: true,
        },
        context,
      );
      // create folder tree
      await createTree(folderTreeDepth, folderData, parentDrive, context, client);
      console.log(`✅ User ${user.id} folder tree created`);
    }
    console.log("✅ Finished execution, took: ", (Date.now() - updateBegin) / 1000, "s");
  },
};

export default command;
