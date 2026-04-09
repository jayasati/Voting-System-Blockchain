// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract Voting {

    struct Candidate {
        string name;
        uint voteCount;
    }

    mapping(uint => Candidate) public candidates;
    mapping(address => bool) public hasVoted;
    uint public candidatesCount;
    address public owner;
    bool public votingActive;

    event VoteCast(address indexed voter, uint indexed candidateId);
    event CandidateAdded(uint id, string name);
    event VotingStatusChanged(bool active);

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner!");
        _;
    }

    modifier isActive() {
        require(votingActive, "Voting is not active!");
        _;
    }

    constructor() {
        owner = msg.sender;
        votingActive = true;
    }

    function addCandidate(string memory _name) public onlyOwner {
        candidatesCount++;
        candidates[candidatesCount] = Candidate(_name, 0);
        emit CandidateAdded(candidatesCount, _name);
    }

    function vote(uint _candidateId) public isActive {
        require(!hasVoted[msg.sender], "Already voted!");
        require(_candidateId >= 1 && _candidateId <= candidatesCount, "Invalid candidate!");
        hasVoted[msg.sender] = true;
        candidates[_candidateId].voteCount++;
        emit VoteCast(msg.sender, _candidateId);
    }

    function toggleVoting() public onlyOwner {
        votingActive = !votingActive;
        emit VotingStatusChanged(votingActive);
    }

    function getCandidate(uint _id) public view returns (string memory name, uint voteCount) {
        require(_id >= 1 && _id <= candidatesCount, "Invalid ID!");
        return (candidates[_id].name, candidates[_id].voteCount);
    }

    function getWinner() public view returns (string memory winnerName, uint winnerVotes) {
        require(candidatesCount > 0, "No candidates!");
        uint winningVotes = 0;
        uint winnerId = 1;
        for (uint i = 1; i <= candidatesCount; i++) {
            if (candidates[i].voteCount > winningVotes) {
                winningVotes = candidates[i].voteCount;
                winnerId = i;
            }
        }
        return (candidates[winnerId].name, candidates[winnerId].voteCount);
    }
}