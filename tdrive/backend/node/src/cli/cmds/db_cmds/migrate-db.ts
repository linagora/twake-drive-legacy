import yargs from "yargs";
import runWithPlatform from "../../lib/run-with-platform";
import runWithLoggerLevel from "../../utils/run-with-logger-level";
import gr from "../../../services/global-resolver";
type CLIArgs = {
  name: string;
};

// eslint-disable-next-line @typescript-eslint/ban-types
const command: yargs.CommandModule<unknown, CLIArgs> = {
  command: "migrate",
  builder: {
    name: {
      default: "",
      type: "string",
      description: "Entity name to migrate",
    },
    output: {
      default: "",
      type: "string",
      description: "Migration output log",
    },
  },
  describe:
    "command to export everything inside a company (publicly data only available to a new member)",
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  handler: async argv => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    await runWithPlatform("Re-index", async ({ spinner, platform }) => {
      return await runWithLoggerLevel(
        argv.verboseDuringRun
          ? (argv.verboseDuringRun as number) > 1
            ? "debug"
            : "info"
          : undefined,
        async () => {
          const targetEntity = argv.name;
          const targetService = await gr.services["users"];
          const entityClass = targetService.repository.entityType;
          const entity = entityClass.prototype;
          // console.log("Migrating entity: \n", JSON.stringify(entity), "\n");
          const schema = JSON.parse(await gr.database.getConnector().migrate(targetEntity));
          // Define a mapping between JavaScript data types and PostgreSQL data types
          const dataTypeMapping = {
            string: "text",
            number: "bigint",
            boolean: "boolean",
            object: "jsonb", // Assuming JSON objects are stored as jsonb in PostgreSQL
            date: "timestamp", // Assuming dates are stored as timestamps in PostgreSQL
            array: "jsonb[]", // Assuming arrays are stored as JSON arrays in PostgreSQL
            float: "real", // Assuming floating-point numbers are stored as real in PostgreSQL
            double: "double precision", // Assuming double-precision floating-point numbers are stored as double precision in PostgreSQL
            int: "integer", // Assuming integer numbers are stored as integer in PostgreSQL
            bigint: "bigint", // Assuming big integer numbers are stored as bigint in PostgreSQL
            smallint: "smallint", // Assuming small integer numbers are stored as smallint in PostgreSQL
            decimal: "numeric", // Assuming decimal numbers are stored as numeric in PostgreSQL
            encoded_json: "text", // Assuming encoded JSON objects are stored as text in PostgreSQL
          };
          console.log("\n ##################################### \n");

          // Compare schema with entity
          const addedColumns = [];
          const deletedColumns = [];
          const changedColumns = [];

          // Check for added columns and renamed columns
          Object.keys(entity._columns).forEach(columnName => {
            const columnExistsInSchema = schema.some(
              schemaField => schemaField.column_name === columnName,
            );
            if (!columnExistsInSchema) {
              addedColumns.push(columnName);
            } else {
              const schemaField = schema.find(field => field.column_name === columnName);
              const entityField = entity._columns[columnName];

              // Check if the column has a 'rename' option
              const renameOption = entityField.options && entityField.options.rename;
              const renamedColumnName = renameOption ? renameOption : columnName;
              const columnAlreadyRenamed = schema.some(
                schemaField => schemaField.column_name === renamedColumnName,
              );
              if (columnAlreadyRenamed && renameOption) {
                console.log(
                  `⚠️ Column '${columnName}' renamed to '${renamedColumnName}, please update the entity and remove the 'rename' option from the column definition: ${columnAlreadyRenamed}, ${renameOption}`,
                );
              }

              // Map JavaScript data types to PostgreSQL data types if needed
              const mappedEntityType = dataTypeMapping[entityField.type] || entityField.type;

              if (
                (schemaField.column_name !== renamedColumnName && !columnAlreadyRenamed) ||
                schemaField.data_type !== mappedEntityType
              ) {
                changedColumns.push({
                  columnName,
                  renamedColumnName,
                  schemaType: schemaField.data_type,
                  entityType: mappedEntityType,
                });
              }
            }
          });

          // Check for deleted columns (including renamed columns)
          schema.forEach(schemaField => {
            const columnName = schemaField.column_name;
            const columnExistsInEntity = entity._columns.hasOwnProperty(columnName);
            if (!columnExistsInEntity) {
              // Check if the column was renamed in the entity options
              const renamedColumn = Object.values(entity._columns).find(
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (field: any) => field?.options && field.options.rename === columnName,
              );
              if (!renamedColumn) {
                deletedColumns.push(columnName);
              }
            }
          });

          // Output changes
          console.log("\nChanges detected:\n");

          if (addedColumns.length > 0) {
            console.log("Added columns:");
            addedColumns.forEach(columnName => console.log(`- ${columnName}`));
          } else {
            console.log("No new columns added");
          }

          if (deletedColumns.length > 0) {
            console.log("\nDeleted columns:");
            deletedColumns.forEach(columnName => console.log(`- ${columnName}`));
          } else {
            console.log("No columns deleted");
          }

          if (changedColumns.length > 0) {
            console.log("\nChanged columns:");
            changedColumns.forEach(({ columnName, renamedColumnName, schemaType, entityType }) => {
              if (columnName !== renamedColumnName) {
                console.log(`- Column '${columnName}' renamed to '${renamedColumnName}'`);
              }
              if (schemaType !== entityType) {
                console.log(
                  `- Column '${columnName}' type changed from '${schemaType}' to '${entityType}'`,
                );
              }
            });
          } else {
            console.log("No columns changed");
          }

          // Show appropriate PostgreSQL queries
          console.log("\nPostgreSQL Queries:");
          addedColumns.forEach(columnName =>
            console.log(
              `ALTER TABLE public."${targetEntity}" ADD COLUMN ${columnName} <data_type>;`,
            ),
          );
          deletedColumns.forEach(columnName =>
            console.log(`ALTER TABLE public."${targetEntity}" DROP COLUMN ${columnName};`),
          );
          changedColumns.forEach(({ columnName, renamedColumnName }) => {
            if (columnName !== renamedColumnName) {
              console.log(
                `ALTER TABLE public."${targetEntity}" RENAME COLUMN ${columnName} TO ${renamedColumnName};`,
              );
            }
          });
          console.log("\n");
        },
      );
    });
  },
};

export default command;
