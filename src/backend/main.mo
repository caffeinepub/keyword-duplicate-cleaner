import Text "mo:core/Text";
import Map "mo:core/Map";
import Array "mo:core/Array";
import List "mo:core/List";
import Nat "mo:core/Nat";
import Runtime "mo:core/Runtime";
import Iter "mo:core/Iter";

actor {
  // DATA TYPES

  type KeywordEntry = {
    id : Nat;
    keyword : Text;
    frequency : Nat;
  };

  module KeywordEntry {
    public func compare(entry1 : KeywordEntry, entry2 : KeywordEntry) : { #less; #equal; #greater } {
      Nat.compare(entry1.id, entry2.id);
    };
  };

  type DuplicateGroup = {
    keyword : Text;
    winner : KeywordEntry;
    duplicates : [KeywordEntry];
  };

  // DATA STORAGE

  var nextId = 1;

  let entries = Map.empty<Nat, KeywordEntry>();

  // CORE FUNCTIONS

  public shared ({ caller }) func addEntry(keyword : Text, frequency : Nat) : async Nat {
    let entry = {
      id = nextId;
      keyword;
      frequency;
    };
    entries.add(nextId, entry);
    nextId += 1;
    entry.id;
  };

  public shared ({ caller }) func addEntries(newEntries : [(Text, Nat)]) : async [Nat] {
    let ids = List.empty<Nat>();
    for ((keyword, frequency) in newEntries.values()) {
      let id = await addEntry(keyword, frequency);
      ids.add(id);
    };
    ids.toArray();
  };

  public shared ({ caller }) func deleteEntry(id : Nat) : async () {
    if (not entries.containsKey(id)) {
      Runtime.trap("Entry not found");
    };
    entries.remove(id);
  };

  public shared ({ caller }) func clearAll() : async () {
    entries.clear();
  };

  public query ({ caller }) func getAllEntries() : async [KeywordEntry] {
    entries.values().toArray().sort();
  };

  public query ({ caller }) func analyzeDuplicates() : async [DuplicateGroup] {
    let grouped = Map.empty<Text, List.List<KeywordEntry>>();

    for (entry in entries.values()) {
      switch (grouped.get(entry.keyword)) {
        case (null) {
          let entryList = List.empty<KeywordEntry>();
          entryList.add(entry);
          grouped.add(entry.keyword, entryList);
        };
        case (?existingList) {
          existingList.add(entry);
        };
      };
    };

    let resultGroups = List.empty<DuplicateGroup>();

    for ((keyword, entryList) in grouped.entries()) {
      if (entryList.size() > 1) {
        let sortedEntries = entryList.toArray().sort();
        let winner = sortedEntries.foldLeft<KeywordEntry, ?KeywordEntry>(
          null,
          func(best, current) {
            switch (best) {
              case (null) { ?current };
              case (?b) {
                if (current.frequency > b.frequency) { ?current } else { ?b };
              };
            };
          },
        );

        switch (winner) {
          case (?w) {
            let duplicates = sortedEntries.filter(
              func(e) {
                e.id != w.id and e.frequency <= w.frequency
              }
            );
            if (duplicates.size() > 0) {
              resultGroups.add({
                keyword;
                winner = w;
                duplicates;
              });
            };
          };
          case (null) {};
        };
      };
    };

    resultGroups.toArray();
  };

  public shared ({ caller }) func cleanDuplicates() : async () {
    let groups = await analyzeDuplicates();
    for (group in groups.values()) {
      for (duplicate in group.duplicates.values()) {
        entries.remove(duplicate.id);
      };
    };
  };
};
